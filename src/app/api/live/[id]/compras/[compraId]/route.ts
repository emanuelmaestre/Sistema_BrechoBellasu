import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; compraId: string }> }
) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 })
  const { id, compraId } = await params
  const body = await req.json().catch(() => ({})) as { pagamento_status?: string }
  if (!body.pagamento_status) return NextResponse.json({ erro: "pagamento_status obrigatorio." }, { status: 400 })
  const sb = createServerClient()
  const { error } = await sb.from("live_compras")
    .update({ pagamento_status: body.pagamento_status })
    .eq("id", parseInt(compraId))
    .eq("live_id", parseInt(id))
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; compraId: string }> }
) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 })
  const { id, compraId } = await params
  const sb = createServerClient()
  const { data: compra } = await sb.from("live_compras").select("id").eq("id", parseInt(compraId)).eq("live_id", parseInt(id)).single()
  if (!compra) return NextResponse.json({ erro: "Compra nao encontrada." }, { status: 404 })
  const { error } = await sb.from("live_compras").delete().eq("id", parseInt(compraId))
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}