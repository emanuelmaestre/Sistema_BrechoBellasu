import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const sb = createServerClient()

  const { data: live, error } = await sb.from("lives").select("*").eq("id", id).single()
  if (error || !live) return NextResponse.json({ erro: "Live não encontrada." }, { status: 404 })

  const { data: compras } = await sb.from("live_compras").select("*").eq("live_id", id).order("created_at")
  const ids = (compras ?? []).map(c => c.id)

  let itens: unknown[] = []
  if (ids.length) {
    const { data } = await sb.from("live_compra_itens").select("*").in("compra_id", ids)
    itens = data ?? []
  }

  const comprasComItens = (compras ?? []).map(c => ({
    ...c,
    itens: (itens as Array<{compra_id: number}>).filter(i => i.compra_id === c.id),
  }))

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
