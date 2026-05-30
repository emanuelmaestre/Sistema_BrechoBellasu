import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

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

  // Verifica estoque disponível
  if (produto_id) {
    const { data: prod } = await sb.from("produtos").select("estoque, nome").eq("id", produto_id).single()
    if (prod && (prod.estoque ?? 0) < (quantidade ?? 1)) {
      return NextResponse.json({ erro: `Estoque insuficiente para "${prod.nome}". Disponível: ${prod.estoque ?? 0}` }, { status: 422 })
    }
  }

  // Tenta inserir nas possíveis tabelas com fallback progressivo
  const compraIdNum = parseInt(compraId)
  const qtd = quantidade ?? 1
  const precoOrig = preco_original ?? 0
  const precoLv = preco_live ?? preco_original ?? 0
  // ── INSERT com fallback em 2 tabelas ──
  const tabelas = ["live_compra_produtos", "live_compra_itens"] as const
  const tentativas: Array<{ tabela: string; cols: string; erro: string }> = []
  let item: Record<string, unknown> | null = null
  let tabelaUsada = ""

  for (const tabela of tabelas) {
    // Colunas específicas por tabela
    const payload: Record<string, unknown> = {
      compra_id: compraIdNum,
      produto_id: produto_id ?? null,
      nome_produto,
      quantidade: qtd,
    }

    if (tabela === "live_compra_produtos") {
      payload.preco_original = precoOrig
      payload.preco_live = precoLv
    } else {
      payload.preco_unitario = precoOrig
      payload.desconto_item = 0
    }

    const r1 = await sb.from(tabela).insert(payload).select().single()
    if (!r1.error) {
      item = r1.data
      tabelaUsada = tabela
      break
    }
    tentativas.push({ tabela, cols: "full", erro: r1.error.message })

    // Tenta com colunas mínimas
    const r2 = await sb.from(tabela).insert({
      compra_id: compraIdNum,
      produto_id: produto_id ?? null,
      nome_produto,
      quantidade: qtd,
    }).select().single()
    if (!r2.error) {
      item = r2.data
      tabelaUsada = tabela
      break
    }
    tentativas.push({ tabela, cols: "base", erro: r2.error.message })
  }

  if (!item) {
    const detalhe = tentativas.map(t => `${t.tabela}(${t.cols}): ${t.erro}`).join(" | ")
    console.error("[POST vincular] TODAS tentativas falharam:", detalhe)
    return NextResponse.json({ erro: detalhe }, { status: 500 })
  }

  // Baixa no estoque
  if (produto_id) {
    try {
      await sb.rpc("decrementar_estoque", { p_produto_id: produto_id, p_qtd: qtd })
    } catch {
      // fallback: busca estoque por nome de coluna possível
      const { data: prod } = await sb.from("produtos").select("*").eq("id", produto_id).single()
      if (prod) {
        const estoqueAtual = (prod as Record<string,unknown>).estoque_atual ?? (prod as Record<string,unknown>).estoque ?? 0
        await sb.from("produtos").update({ estoque_atual: Math.max(0, Number(estoqueAtual) - qtd) }).eq("id", produto_id)
      }
    }
    // Marca estoque baixado na tabela usada
    await sb.from(tabelaUsada).update({ estoque_baixado: true }).eq("id", item.id).then(() => {})
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

  // Tenta ambas as tabelas
  let prods: Array<{ quantidade?: number; estoque_baixado?: boolean }> = []
  const r1 = await sb.from("live_compra_produtos").select("quantidade, estoque_baixado").eq("compra_id", compraId)
  if (!r1.error && r1.data?.length) prods = r1.data
  else {
    const r2 = await sb.from("live_compra_itens").select("quantidade").eq("compra_id", compraId)
    if (!r2.error) prods = (r2.data ?? []).map(p => ({ ...p, estoque_baixado: false }))
  }

  const totalVinculado = prods.reduce((s, p) => s + (p.quantidade ?? 1), 0)
  const totalBaixado   = prods.filter(p => p.estoque_baixado).reduce((s, p) => s + (p.quantidade ?? 1), 0)
  const qtdEsperada    = compra?.quantidade_itens ?? 0

  let status = "cadastrada"
  if (totalVinculado === 0) status = "aguardando_vinculo"
  else if (totalVinculado < qtdEsperada) status = "vinculo_parcial"
  else if (totalVinculado >= qtdEsperada && totalBaixado >= qtdEsperada) status = "vinculada"
  else status = "vinculo_parcial"

  try {
    await sb.from("live_compras").update({ status_compra: status }).eq("id", compraId)
  } catch { /* coluna status_compra pode não existir */ }
}
