import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { searchParams } = req.nextUrl
  const de          = searchParams.get("de")
  const ate         = searchParams.get("ate")
  const cliente_id  = searchParams.get("cliente_id")
  const vendedor_id = searchParams.get("vendedor_id")
  const page        = parseInt(searchParams.get("page") ?? "1")
  const limit       = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)
  const from        = (page - 1) * limit
  const to          = from + limit - 1

  const sb = createServerClient()
  let q = sb.from("v_vendas").select("*", { count: "exact" })

  // A view usa created_at, não data_venda — filtra pela data de criação (UTC→BR)
  if (de)          q = q.gte("created_at", `${de}T00:00:00`)
  if (ate)         q = q.lte("created_at", `${ate}T23:59:59`)
  if (cliente_id)  q = q.eq("cliente_id", cliente_id)
  if (vendedor_id) q = q.eq("vendedor_id", vendedor_id)

  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, to)
  if (error) {
    console.error("[GET /api/vendas]", error)
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  // Buscar qtd_itens por venda (um único join)
  const ids = (data ?? []).map((v: Record<string, unknown>) => v.id as number)
  let qtdMap: Record<number, number> = {}
  if (ids.length > 0) {
    const { data: itensCount } = await sb
      .from("venda_itens")
      .select("venda_id, qtd")
      .in("venda_id", ids)
    if (itensCount) {
      for (const row of itensCount as { venda_id: number; qtd: number }[]) {
        qtdMap[row.venda_id] = (qtdMap[row.venda_id] ?? 0) + row.qtd
      }
    }
  }

  // Mapear para o formato esperado pelo frontend
  const mapped = (data ?? []).map((v: Record<string, unknown>) => {
    const dt = new Date(v.created_at as string)
    const datePart = dt.toISOString().split("T")[0]                          // "2026-05-23"
    const timePart = dt.toTimeString().slice(0, 8)                           // "13:02:07"
    return {
      id:             v.id,
      numero:         v.id,          // usar id como número sequencial
      data_venda:     datePart,
      hora_venda:     timePart,
      cliente_id:     v.cliente_id,
      cliente_nome:   v.cliente_nome,
      vendedor_nome:  v.vendedor_nome,
      qtd_itens:      qtdMap[v.id as number] ?? 0,
      total:          v.total,
      forma_pagamento: v.forma_pagamento,
      status:         v.status,
      desconto:       v.desconto,
      observacoes:    v.obs,
    }
  })

  return NextResponse.json({ data: mapped, total: count })
}

export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const body = await req.json()
  const { cliente_id, forma_pagamento, desconto_geral, observacoes, itens } = body

  if (!itens?.length) {
    return NextResponse.json({ erro: "A venda precisa ter ao menos um item." }, { status: 400 })
  }

  type ItemInput = { produto_id?: number | null; nome_produto?: string; nome?: string; quantidade?: number; qtd?: number; preco_unitario?: number; preco_unit?: number }

  const itensNorm = (itens as ItemInput[]).map(it => ({
    produto_id: it.produto_id ?? null,
    nome:       it.nome_produto ?? it.nome ?? "",
    qtd:        it.quantidade   ?? it.qtd  ?? 1,
    preco_unit: it.preco_unitario ?? it.preco_unit ?? 0,
  }))

  const subtotal   = itensNorm.reduce((s, it) => s + it.preco_unit * it.qtd, 0)
  const desconto   = Number(desconto_geral) || 0
  const total      = Math.max(0, subtotal - desconto)

  const sb = createServerClient()

  // 1. Inserir venda
  const { data: venda, error: errVenda } = await sb
    .from("vendas")
    .insert({
      cliente_id:      cliente_id ?? null,
      vendedor_id:     auth.id,
      forma_pagamento: forma_pagamento ?? "Dinheiro",
      subtotal,
      desconto,
      total,
      obs:             observacoes ?? null,
      status:          "concluida",
    })
    .select("id")
    .single()

  if (errVenda) {
    console.error("[POST /api/vendas] insert venda:", errVenda)
    return NextResponse.json({ erro: errVenda.message }, { status: 500 })
  }

  const vendaId = venda.id

  // 2. Inserir itens
  const itensInsert = itensNorm.map(it => ({
    venda_id:   vendaId,
    produto_id: it.produto_id,
    nome:       it.nome,
    preco_unit: it.preco_unit,
    qtd:        it.qtd,
    subtotal:   it.preco_unit * it.qtd,
  }))

  const { error: errItens } = await sb.from("venda_itens").insert(itensInsert)
  if (errItens) {
    console.error("[POST /api/vendas] insert itens:", errItens)
    return NextResponse.json({ erro: errItens.message }, { status: 500 })
  }

  // 3. Decrementar estoque_atual dos produtos com produto_id
  for (const it of itensNorm) {
    if (it.produto_id) {
      const { data: prod } = await sb
        .from("produtos")
        .select("estoque_atual")
        .eq("id", it.produto_id)
        .single()
      if (prod) {
        await sb
          .from("produtos")
          .update({ estoque_atual: (prod.estoque_atual ?? 0) - it.qtd })
          .eq("id", it.produto_id)
      }
    }
  }

  return NextResponse.json({ id: vendaId, total }, { status: 201 })
}
