import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { CancelarVendaUseCase } from "@/application/vendas/cancelar-venda.use-case"
import { VendaRepositorySupabase } from "@/infrastructure/repositories/venda.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const sb = createServerClient()

  const { data: venda, error } = await sb.from("v_vendas").select("*").eq("id", id).single()
  if (error || !venda) return NextResponse.json({ erro: "Venda não encontrada." }, { status: 404 })

  const { data: itensRaw } = await sb.from("venda_itens").select("*").eq("venda_id", id)

  // Mapear itens para o formato esperado pelo frontend
  const itens = (itensRaw ?? []).map((it: Record<string, unknown>) => ({
    nome_produto:   it.nome,
    quantidade:     it.qtd,
    preco_unitario: it.preco_unit,
    subtotal:       (it.preco_unit as number) * (it.qtd as number),
  }))

  const v = venda as Record<string, unknown>
  const dt = new Date(v.created_at as string)

  return NextResponse.json({
    id:             v.id,
    numero:         v.id,
    data_venda:     dt.toISOString().split("T")[0],
    hora_venda:     dt.toTimeString().slice(0, 8),
    cliente_nome:   v.cliente_nome,
    vendedor_nome:  v.vendedor_nome,
    forma_pagamento: v.forma_pagamento,
    desconto:       v.desconto,
    total:          v.total,
    qtd_itens:      itens.length,
    observacoes:    v.obs,
    status:         v.status,
    itens,
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  try {
    const { id } = await params
    const sb = createServerClient()
    const useCase = new CancelarVendaUseCase(new VendaRepositorySupabase(sb))

    const resultado = await useCase.execute(parseInt(id))
    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[DELETE /api/vendas/[id]]", err)
    return NextResponse.json(erro, { status })
  }
}
