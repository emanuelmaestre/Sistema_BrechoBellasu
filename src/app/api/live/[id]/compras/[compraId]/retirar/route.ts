import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string; compraId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id, compraId } = await params
  const sb = createServerClient()

  const { data: compra } = await sb
    .from("live_compras")
    .select("id, status_compra, live_id")
    .eq("id", parseInt(compraId))
    .eq("live_id", parseInt(id))
    .single()

  if (!compra) return NextResponse.json({ erro: "Compra não encontrada." }, { status: 404 })
  if (compra.status_compra !== "finalizada")
    return NextResponse.json({ erro: "Compra precisa estar finalizada para confirmar retirada." }, { status: 422 })

  const { error } = await sb
    .from("live_compras")
    .update({ status_compra: "retirada" })
    .eq("id", parseInt(compraId))

  if (error) {
    console.error("[POST retirar]", error)
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
