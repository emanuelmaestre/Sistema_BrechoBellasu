import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { calcularStatusCompra } from "@/domain/live/status-compra"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const sb = createServerClient()

  const { data: live, error } = await sb.from("lives").select("*").eq("id", id).single()
  if (error || !live) return NextResponse.json({ erro: "Live não encontrada." }, { status: 404 })

  const { data: compras } = await sb.from("live_compras").select("*").eq("live_id", id).order("created_at")
  const ids = (compras ?? []).map(c => c.id)

  // Busca produtos de AMBAS as tabelas (nova + legada)
  type ProdRow = { compra_id: number; quantidade: number; estoque_baixado?: boolean }
  let produtosNovos: ProdRow[] = []
  let itensLegados: unknown[] = []

  if (ids.length) {
    const [rNovos, rLegados] = await Promise.all([
      sb.from("live_compra_produtos").select("compra_id, quantidade, estoque_baixado").in("compra_id", ids),
      sb.from("live_compra_itens").select("*").in("compra_id", ids),
    ])
    produtosNovos = (rNovos.data ?? []) as ProdRow[]
    itensLegados = rLegados.data ?? []
  }

  // Agrupa produtos por compra_id
  const prodMap: Record<number, ProdRow[]> = {}
  for (const p of produtosNovos) {
    if (!prodMap[p.compra_id]) prodMap[p.compra_id] = []
    prodMap[p.compra_id].push(p)
  }

  // Reconstrói compras com contagens recalculadas dinamicamente
  const comprasComItens = (compras ?? []).map(c => {
    const prods = prodMap[c.id] ?? []
    const vinculos = prods.map(p => ({ quantidade: Number(p.quantidade ?? 1), estoqueBaixado: p.estoque_baixado === true }))
    const totalVinculados = vinculos.reduce((s, v) => s + v.quantidade, 0)
    const totalBaixados   = vinculos.filter(v => v.estoqueBaixado).reduce((s, v) => s + v.quantidade, 0)
    const statusCalculado = calcularStatusCompra(Number(c.quantidade_itens ?? 0), vinculos)
    // "retirada" é um estado manual pós-finalização — não é derivável do vínculo
    // de produtos, então preserva o valor do banco enquanto a compra continuar
    // com tudo vinculado (cálculo = "finalizada").
    const statusFinal = c.status_compra === "retirada" && statusCalculado === "finalizada"
      ? "retirada"
      : statusCalculado

    return {
      ...c,
      // Recalcula em tempo real — ignora valor stale do banco
      total_produtos_vinculados: totalVinculados,
      total_estoque_baixado:     totalBaixados,
      status_compra:             statusFinal,
      itens: (itensLegados as Array<{compra_id: number}>).filter(i => i.compra_id === c.id),
    }
  })

  return NextResponse.json({ ...live, compras: comprasComItens })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const { status } = await req.json()
  if (!status) return NextResponse.json({ erro: "Status obrigatório." }, { status: 400 })

  const sb = createServerClient()
  const { data, error } = await sb.from("lives").update({ status }).eq("id", id).select().single()
  if (error) return NextResponse.json({ erro: "Erro ao atualizar status." }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const sb = createServerClient()
  const { error } = await sb.from("lives").delete().eq("id", id)
  if (error) return NextResponse.json({ erro: "Erro ao excluir live." }, { status: 500 })
  return NextResponse.json({ ok: true })
}
