import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const live_id = parseInt(id)
  const sb = createServerClient()

  const { data: compras } = await sb.from("live_compras").select("id, status_compra, nome_cliente").eq("live_id", live_id)
  if (!compras?.length) {
    await sb.from("lives").update({ status: "encerrada" }).eq("id", live_id)
    return NextResponse.json({ ok: true })
  }

  const pendentes = compras.filter(c => c.status_compra !== "finalizada")
  if (pendentes.length > 0) {
    return NextResponse.json({
      erro: `Ainda existem ${pendentes.length} compra(s) sem produtos vinculados ou não finalizadas. Finalize todas as compras antes de encerrar a live.`,
      pendentes: pendentes.map(c => ({ id: c.id, cliente: c.nome_cliente, status: c.status_compra }))
    }, { status: 422 })
  }

  await sb.from("lives").update({ status: "encerrada" }).eq("id", live_id)
  return NextResponse.json({ ok: true })
}
