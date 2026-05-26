import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const sb = createServerClient()
  const { error } = await sb.from("contas_pagar").delete().eq("id", id)
  if (error) return NextResponse.json({ erro: "Erro ao excluir conta." }, { status: 500 })
  return NextResponse.json({ ok: true })
}
