import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

// GET /api/clientes/[id]/historico — Histórico completo: vendas, lives, trocas e envios
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const clienteId = parseInt(id)
  const sb = createServerClient()

  const [vendasRes, trocasRes, enviosRes, liveComprasRes] = await Promise.all([
    // Vendas PDV
    sb.from("vendas")
      .select("id, created_at, total, forma_pagamento, status, desconto, obs")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false }),

    // Trocas / devoluções
    sb.from("trocas")
      .select("id, tipo, status, motivo, created_at, venda_id")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false }),

    // Etiquetas / envios
    sb.from("etiquetas")
      .select("id, created_at, me_tracking, status")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false }),

    // Compras de live
    sb.from("live_compras")
      .select(`
        id, created_at, numero_sacola, quantidade_itens,
        valor_total, desconto, credito_aplicado, status_compra, pagamento_status,
        lives ( id, titulo, data_live, plataforma ),
        live_compra_produtos ( nome_produto, quantidade, preco_live )
      `)
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false }),
  ])

  const vendas = vendasRes.data ?? []
  const trocas = trocasRes.data ?? []
  const envios = (enviosRes.data ?? []).map(e => ({
    id: e.id,
    created_at: e.created_at,
    rastreio: e.me_tracking,
    ultimo_status: e.status,
  }))

  // Itens das vendas
  const vendaIds = vendas.map(v => v.id)
  const itensMap: Record<number, { nome: string; qtd: number; preco_unit: number; subtotal: number }[]> = {}
  if (vendaIds.length > 0) {
    const { data: itens } = await sb
      .from("venda_itens")
      .select("venda_id, nome, qtd, preco_unit, subtotal")
      .in("venda_id", vendaIds)
    for (const it of (itens ?? []) as { venda_id: number; nome: string; qtd: number; preco_unit: number; subtotal: number }[]) {
      if (!itensMap[it.venda_id]) itensMap[it.venda_id] = []
      itensMap[it.venda_id].push({ nome: it.nome, qtd: it.qtd, preco_unit: it.preco_unit, subtotal: it.subtotal })
    }
  }

  const vendasFormatadas = vendas.map(v => ({
    ...v,
    data: v.created_at,
    itens: itensMap[v.id] ?? [],
  }))

  // Compras de live formatadas.
  // O Supabase tipa joins embutidos como array; em relação muitos-para-um o
  // runtime devolve objeto. Normalizamos os dois casos.
  type LiveRef = { id: number; titulo: string; data_live: string; plataforma: string }
  type LiveCompraRow = {
    id: number
    created_at: string
    numero_sacola: number | null
    quantidade_itens: number
    valor_total: number
    desconto: number
    credito_aplicado: number
    status_compra: string
    pagamento_status: string
    lives: LiveRef | LiveRef[] | null
    live_compra_produtos: { nome_produto: string; quantidade: number; preco_live: number }[]
  }

  const liveComprasRows = (liveComprasRes.data ?? []) as unknown as LiveCompraRow[]

  const liveCompras = liveComprasRows.map(c => ({
    id: c.id,
    created_at: c.created_at,
    numero_sacola: c.numero_sacola,
    quantidade_itens: c.quantidade_itens,
    valor_total: Number(c.valor_total),
    desconto: Number(c.desconto ?? 0),
    credito_aplicado: Number(c.credito_aplicado ?? 0),
    valor_final: Math.max(0, Number(c.valor_total) - Number(c.desconto ?? 0) - Number(c.credito_aplicado ?? 0)),
    status_compra: c.status_compra,
    pagamento_status: c.pagamento_status,
    live: Array.isArray(c.lives) ? (c.lives[0] ?? null) : c.lives,
    produtos: c.live_compra_produtos ?? [],
  }))

  // Totais: vendas não canceladas + compras de live pagas
  const totalVendas = vendasFormatadas
    .filter(v => v.status !== "cancelada")
    .reduce((s, v) => s + Number(v.total), 0)

  const totalLives = liveCompras
    .filter(c => c.pagamento_status === "PAGO")
    .reduce((s, c) => s + c.valor_final, 0)

  return NextResponse.json({
    vendas: vendasFormatadas,
    trocas,
    envios,
    live_compras: liveCompras,
    total_gasto: totalVendas + totalLives,
    total_compras: vendasFormatadas.filter(v => v.status !== "cancelada").length + liveCompras.length,
  })
}
