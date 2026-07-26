import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAdminAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

export const DELETE = withAdminAuth(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const sb = createServerClient()
  const { error } = await sb.from("contas_pagar").delete().eq("id", id)
  if (error) return NextResponse.json({ erro: "Erro ao excluir conta." }, { status: 500 })
  return NextResponse.json({ ok: true })
})
