import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

type Params = { params: Promise<{ id: string; compraId: string }> }

// GET — lista produtos vinculados
export async function GET(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { compraId } = await params
  const sb = createServerClient()
  const { data, error } = await sb.from("live_compra_produtos").select("*").eq("compra_id", parseInt(compraId)).order("id")
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — vincular produto à compra
export async function POST(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { compraId } = await params
  const body = await req.json()
  const { produto_id, nome_produto, quantidade, preco_original, preco_live } = body

  if (!nome_produto) return NextResponse.json({ erro: "Nome do produto obrigatório." }, { status: 400 })

  const sb = createServerClient()

  // Impede produto duplicado em outra compra da mesma live
  if (produto_id) {
    const compra = await sb.from("live_compras").select("live_id").eq("id", parseInt(compraId)).single()
    if (compra.data?.live_id) {
      const { data: jaVinculado } = await sb
        .from("live_compra_produtos")
        .select("id, compra_id")
        .eq("produto_id", produto_id)
        .neq("compra_id", parseInt(compraId))

      if (jaVinculado && jaVinculado.length > 0) {
        // verifica se está na mesma live
        const compraIds = jaVinculado.map(r => r.compra_id)
        const { data: comprasLive } = await sb
          .from("live_compras")
          .select("id")
          .eq("live_id", compra.data.live_id)
          .in("id", compraIds)
        if (comprasLive && comprasLive.length > 0) {
          return NextResponse.json({ erro: "Este produto já está vinculado em outra compra desta live." }, { status: 409 })
        }
      }
    }
  }

  // Verifica estoque disponível
  if (produto_id) {
    const { data: prod } = await sb.from("produtos").select("estoque, nome").eq("id", produto_id).single()
    if (prod && (prod.estoque ?? 0) < (quantidade ?? 1)) {
      return NextResponse.json({ erro: `Estoque insuficiente para "${prod.nome}". Disponível: ${prod.estoque ?? 0}` }, { status: 422 })
    }
  }

  const { data: item, error } = await sb.from("live_compra_produtos").insert({
    compra_id: parseInt(compraId),
    produto_id: produto_id ?? null,
    nome_produto,
    quantidade: quantidade ?? 1,
    preco_original: preco_original ?? 0,
    preco_live: preco_live ?? preco_original ?? 0,
  }).select().single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Baixa no estoque
  if (produto_id) {
    const rpcResult = sb.rpc("decrementar_estoque", { p_produto_id: produto_id, p_qtd: quantidade ?? 1 })
    try {
      await rpcResult
    } catch {
      // fallback manual se a função não existir
      const { data: prod } = await sb.from("produtos").select("estoque").eq("id", produto_id).single()
      if (prod) {
        await sb.from("produtos").update({ estoque: Math.max(0, (prod.estoque ?? 0) - (quantidade ?? 1)) }).eq("id", produto_id)
      }
    }
    await sb.from("live_compra_produtos").update({ estoque_baixado: true }).eq("id", item.id)
  }

  // Atualiza status_compra da compra
  await atualizarStatusCompra(parseInt(compraId), sb)

  return NextResponse.json(item, { status: 201 })
}

// DELETE — remover produto vinculado
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { compraId } = await params
  const url = new URL(req.url)
  const produtoItemId = url.searchParams.get("item_id")
  if (!produtoItemId) return NextResponse.json({ erro: "item_id obrigatório" }, { status: 400 })

  const sb = createServerClient()

  // Reverte estoque
  const { data: item } = await sb.from("live_compra_produtos").select("*").eq("id", parseInt(produtoItemId)).single()
  if (item?.produto_id && item.estoque_baixado) {
    const { data: prod } = await sb.from("produtos").select("estoque").eq("id", item.produto_id).single()
    if (prod) {
      await sb.from("produtos").update({ estoque: (prod.estoque ?? 0) + (item.quantidade ?? 1) }).eq("id", item.produto_id)
    }
  }

  const { error } = await sb.from("live_compra_produtos").delete().eq("id", parseInt(produtoItemId))
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  await atualizarStatusCompra(parseInt(compraId), sb)
  return NextResponse.json({ ok: true })
}

// ─── Helper: recalcula status_compra ──────────────────────
async function atualizarStatusCompra(compraId: number, sb: ReturnType<typeof import("@/lib/supabase").createServerClient>) {
  const { data: compra } = await sb.from("live_compras").select("quantidade_itens").eq("id", compraId).single()
  const { data: prods }  = await sb.from("live_compra_produtos").select("quantidade, estoque_baixado").eq("compra_id", compraId)

  const totalVinculado = (prods ?? []).reduce((s, p) => s + (p.quantidade ?? 1), 0)
  const totalBaixado   = (prods ?? []).filter(p => p.estoque_baixado).reduce((s, p) => s + (p.quantidade ?? 1), 0)
  const qtdEsperada    = compra?.quantidade_itens ?? 0

  let status = "cadastrada"
  if (totalVinculado === 0) status = "aguardando_vinculo"
  else if (totalVinculado < qtdEsperada) status = "vinculo_parcial"
  else if (totalVinculado >= qtdEsperada && totalBaixado >= qtdEsperada) status = "vinculada"
  else status = "vinculo_parcial"

  await sb.from("live_compras").update({ status_compra: status }).eq("id", compraId)
}
