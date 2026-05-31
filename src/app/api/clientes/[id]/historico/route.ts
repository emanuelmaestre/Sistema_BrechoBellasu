import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

// GET /api/clientes/[id]/historico — Histórico completo de compras do cliente
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const clienteId = parseInt(id)
  const sb = createServerClient()

  // Busca vendas do cliente
  const { data: vendas, error } = await sb
    .from("vendas")
    .select("id, created_at, total, forma_pagamento, status, desconto, obs")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Busca itens de todas as vendas
  const ids = (vendas ?? []).map(v => v.id)
  let itensMap: Record<number, { nome: string; qtd: number; preco_unit: number; subtotal: number }[]> = {}

  if (ids.length > 0) {
    const { data: itens } = await sb
      .from("venda_itens")
      .select("venda_id, nome, qtd, preco_unit, subtotal")
      .in("venda_id", ids)

    for (const it of (itens ?? []) as { venda_id: number; nome: string; qtd: number; preco_unit: number; subtotal: number }[]) {
      if (!itensMap[it.venda_id]) itensMap[it.venda_id] = []
      itensMap[it.venda_id].push({ nome: it.nome, qtd: it.qtd, preco_unit: it.preco_unit, subtotal: it.subtotal })
    }
  }

  // Busca trocas do cliente
  const { data: trocas } = await sb
    .from("trocas")
    .select("id, tipo, status, motivo, created_at, venda_id")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })

  // Busca envios do cliente
  const { data: envios } = await sb
    .from("etiquetas")
    .select("id, created_at, rastreio, ultimo_status")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })

  const resultado = (vendas ?? []).map(v => ({
    ...v,
    data: v.created_at,
    itens: itensMap[v.id] ?? [],
  }))

  return NextResponse.json({
    vendas: resultado,
    trocas: trocas ?? [],
    envios: envios ?? [],
    total_gasto: resultado
      .filter(v => v.status !== "cancelada")
      .reduce((sum, v) => sum + Number(v.total), 0),
    total_compras: resultado.filter(v => v.status !== "cancelada").length,
  })
}
