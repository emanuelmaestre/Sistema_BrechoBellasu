import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { calcularStatusCompra } from "@/domain/live/status-compra"

type Params = { params: Promise<{ id: string; compraId: string }> }

// GET — lista produtos vinculados (tenta ambas as tabelas)
export async function GET(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { compraId } = await params
  const sb = createServerClient()
  const cid = parseInt(compraId)

  const r1 = await sb.from("live_compra_produtos").select("*").eq("compra_id", cid).order("id")
  if (!r1.error) return NextResponse.json(r1.data ?? [])

  const r2 = await sb.from("live_compra_itens").select("*").eq("compra_id", cid).order("id")
  if (!r2.error) return NextResponse.json(r2.data ?? [])

  return NextResponse.json({ erro: `produtos: ${r1.error.message} | itens: ${r2.error.message}` }, { status: 500 })
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

  // Verifica estoque disponível (apenas se o produto controla estoque)
  if (produto_id) {
    const { data: prod } = await sb.from("produtos").select("estoque_atual, controlar_estoque, nome").eq("id", produto_id).single()
    if (prod && prod.controlar_estoque !== false && (prod.estoque_atual ?? 0) < (quantidade ?? 1)) {
      return NextResponse.json({ erro: `Estoque insuficiente para "${prod.nome}". Disponível: ${prod.estoque_atual ?? 0}` }, { status: 422 })
    }
  }

  // Insere na tabela dedicada live_compra_produtos
  const compraIdNum = parseInt(compraId)
  const qtd = quantidade ?? 1
  const precoOrig = preco_original ?? 0
  const precoLv = preco_live ?? preco_original ?? 0
  const { data: item, error } = await sb.from("live_compra_produtos").insert({
    compra_id: compraIdNum,
    produto_id: produto_id ?? null,
    nome_produto,
    quantidade: qtd,
    preco_original: precoOrig,
    preco_live: precoLv,
  }).select().single()

  if (error) {
    console.error("[POST produtos]", error.message)
    return NextResponse.json({ erro: `Erro ao vincular produto: ${error.message}` }, { status: 500 })
  }

  // Baixa no estoque (atualização manual em estoque_atual)
  if (produto_id) {
    const { data: prod } = await sb.from("produtos").select("estoque_atual, controlar_estoque").eq("id", produto_id).single()
    if (prod && prod.controlar_estoque !== false) {
      await sb.from("produtos").update({ estoque_atual: Math.max(0, (prod.estoque_atual ?? 0) - (quantidade ?? 1)) }).eq("id", produto_id)
    }
    // Marca estoque baixado
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
    const { data: prod } = await sb.from("produtos").select("estoque_atual").eq("id", item.produto_id).single()
    if (prod) {
      await sb.from("produtos").update({ estoque_atual: (prod.estoque_atual ?? 0) + (item.quantidade ?? 1) }).eq("id", item.produto_id)
    }
  }

  const { error } = await sb.from("live_compra_produtos").delete().eq("id", parseInt(produtoItemId))
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  await atualizarStatusCompra(parseInt(compraId), sb)
  return NextResponse.json({ ok: true })
}

// ─── Helper: recalcula status_compra (regra no domínio) ────
async function atualizarStatusCompra(compraId: number, sb: ReturnType<typeof import("@/lib/supabase").createServerClient>) {
  const { data: compra } = await sb.from("live_compras").select("quantidade_itens").eq("id", compraId).single()
  const { data: prods } = await sb
    .from("live_compra_produtos")
    .select("quantidade, estoque_baixado")
    .eq("compra_id", compraId)

  const vinculos = (prods ?? []).map(p => ({
    quantidade: Number(p.quantidade ?? 1),
    estoqueBaixado: p.estoque_baixado === true,
  }))
  const status = calcularStatusCompra(Number(compra?.quantidade_itens ?? 0), vinculos)
  const totalVinculados = vinculos.reduce((s, v) => s + v.quantidade, 0)
  const totalBaixados   = vinculos.filter(v => v.estoqueBaixado).reduce((s, v) => s + v.quantidade, 0)

  await sb.from("live_compras").update({
    status_compra: status,
    total_produtos_vinculados: totalVinculados,
    total_estoque_baixado: totalBaixados,
  }).eq("id", compraId)
}
