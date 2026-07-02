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

  const r1 = await sb
    .from("live_compra_produtos")
    .select("*, produtos(marca, cor, tamanho)")
    .eq("compra_id", cid)
    .order("id")
  if (!r1.error) {
    const data = (r1.data ?? []).map(({ produtos: prod, ...rest }) => ({
      ...rest,
      marca:   (prod as { marca?: string | null } | null)?.marca   ?? null,
      cor:     (prod as { cor?:   string | null } | null)?.cor     ?? null,
      tamanho: (prod as { tamanho?: string | null } | null)?.tamanho ?? null,
    }))
    return NextResponse.json(data)
  }

  const r2 = await sb.from("live_compra_itens").select("*").eq("live_compra_id", cid).order("id")
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

  // Valida limites de quantidade e valor da compra
  {
    const compraIdNum = parseInt(compraId)
    const [{ data: compraLimites }, { data: jaVinculados }] = await Promise.all([
      sb.from("live_compras").select("quantidade_itens, valor_total").eq("id", compraIdNum).single(),
      sb.from("live_compra_produtos").select("quantidade, preco_live, preco_original").eq("compra_id", compraIdNum),
    ])

    const qtdEsperada = Number(compraLimites?.quantidade_itens ?? 0)
    const valorTotal  = parseFloat(String(compraLimites?.valor_total ?? 0))
    const qtdAtual    = (jaVinculados ?? []).reduce((s, p) => s + Number(p.quantidade ?? 1), 0)
    const valorAtual  = (jaVinculados ?? []).reduce((s, p) => s + parseFloat(String(p.preco_live ?? p.preco_original ?? 0)) * Number(p.quantidade ?? 1), 0)
    const precoLvNovo = parseFloat(String(preco_live ?? preco_original ?? 0))
    const qtdNova     = quantidade ?? 1

    if (qtdEsperada > 0 && qtdAtual + qtdNova > qtdEsperada) {
      return NextResponse.json({
        erro: `LIMITE DE ITENS ATINGIDO. ESTA COMPRA POSSUI ${qtdEsperada} ITEM(NS) E JÁ FORAM VINCULADOS ${qtdAtual}.`,
      }, { status: 422 })
    }
    if (valorTotal > 0 && valorAtual + precoLvNovo * qtdNova > valorTotal) {
      const fmtVal = (v: number) => "R$ " + v.toFixed(2).replace(".", ",")
      return NextResponse.json({
        erro: `VALOR LIMITE ATINGIDO. ESTA COMPRA TEM TOTAL DE ${fmtVal(valorTotal)} E OS ITENS JÁ VINCULADOS SOMAM ${fmtVal(valorAtual)}. NÃO É POSSÍVEL ADICIONAR MAIS ${fmtVal(precoLvNovo * qtdNova)}.`,
      }, { status: 422 })
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

// PATCH — editar quantidade/preço de um produto já vinculado
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { compraId } = await params
  const url = new URL(req.url)
  const itemIdStr = url.searchParams.get("item_id")
  if (!itemIdStr) return NextResponse.json({ erro: "item_id obrigatório" }, { status: 400 })
  const itemId = parseInt(itemIdStr)
  const compraIdNum = parseInt(compraId)

  const body = await req.json().catch(() => ({})) as { quantidade?: number; preco_original?: number; preco_live?: number }
  const sb = createServerClient()

  const { data: item } = await sb.from("live_compra_produtos").select("*").eq("id", itemId).eq("compra_id", compraIdNum).single()
  if (!item) return NextResponse.json({ erro: "Produto vinculado não encontrado." }, { status: 404 })

  const novaQtd       = body.quantidade ?? item.quantidade ?? 1
  const novoOrig       = body.preco_original ?? item.preco_original ?? 0
  const novoLive       = body.preco_live ?? item.preco_live ?? novoOrig

  if (!Number.isFinite(novaQtd) || novaQtd < 1) {
    return NextResponse.json({ erro: "Quantidade inválida." }, { status: 400 })
  }
  if (!Number.isFinite(novoOrig) || novoOrig < 0 || !Number.isFinite(novoLive) || novoLive < 0) {
    return NextResponse.json({ erro: "Valor inválido." }, { status: 400 })
  }

  // Valida limites de quantidade/valor da compra, excluindo o próprio item
  {
    const [{ data: compraLimites }, { data: outrosVinculados }] = await Promise.all([
      sb.from("live_compras").select("quantidade_itens, valor_total").eq("id", compraIdNum).single(),
      sb.from("live_compra_produtos").select("quantidade, preco_live, preco_original").eq("compra_id", compraIdNum).neq("id", itemId),
    ])

    const qtdEsperada = Number(compraLimites?.quantidade_itens ?? 0)
    const valorTotal  = parseFloat(String(compraLimites?.valor_total ?? 0))
    const qtdOutros    = (outrosVinculados ?? []).reduce((s, p) => s + Number(p.quantidade ?? 1), 0)
    const valorOutros  = (outrosVinculados ?? []).reduce((s, p) => s + parseFloat(String(p.preco_live ?? p.preco_original ?? 0)) * Number(p.quantidade ?? 1), 0)

    if (qtdEsperada > 0 && qtdOutros + novaQtd > qtdEsperada) {
      return NextResponse.json({
        erro: `LIMITE DE ITENS ATINGIDO. ESTA COMPRA POSSUI ${qtdEsperada} ITEM(NS) E OS DEMAIS VÍNCULOS JÁ SOMAM ${qtdOutros}.`,
      }, { status: 422 })
    }
    if (valorTotal > 0 && valorOutros + novoLive * novaQtd > valorTotal) {
      const fmtVal = (v: number) => "R$ " + v.toFixed(2).replace(".", ",")
      return NextResponse.json({
        erro: `VALOR LIMITE ATINGIDO. ESTA COMPRA TEM TOTAL DE ${fmtVal(valorTotal)} E OS DEMAIS VÍNCULOS JÁ SOMAM ${fmtVal(valorOutros)}.`,
      }, { status: 422 })
    }
  }

  // Ajusta estoque pela diferença de quantidade (só se este item já baixou estoque)
  if (item.produto_id && item.estoque_baixado) {
    const delta = novaQtd - Number(item.quantidade ?? 1)  // > 0 = precisa baixar mais; < 0 = devolve
    if (delta !== 0) {
      const { data: prod } = await sb.from("produtos").select("estoque_atual, controlar_estoque, nome").eq("id", item.produto_id).single()
      if (prod && prod.controlar_estoque !== false) {
        const novoEstoque = (prod.estoque_atual ?? 0) - delta
        if (novoEstoque < 0) {
          return NextResponse.json({ erro: `Estoque insuficiente para "${prod.nome}". Disponível: ${prod.estoque_atual ?? 0}` }, { status: 422 })
        }
        await sb.from("produtos").update({ estoque_atual: novoEstoque }).eq("id", item.produto_id)
      }
    }
  }

  const { error } = await sb.from("live_compra_produtos").update({
    quantidade: novaQtd,
    preco_original: novoOrig,
    preco_live: novoLive,
  }).eq("id", itemId)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  await atualizarStatusCompra(compraIdNum, sb)
  return NextResponse.json({ ok: true })
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
