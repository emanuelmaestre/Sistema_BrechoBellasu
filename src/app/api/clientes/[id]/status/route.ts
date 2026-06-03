import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

export const PATCH = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const { ativo } = await req.json()
  if (typeof ativo === "undefined") return NextResponse.json({ erro: "Campo ativo obrigatório." }, { status: 400 })

  const sb = createServerClient()
  const { data, error } = await sb.from("clientes").update({ ativo }).eq("id", id).select().single()
  if (error || !data) return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 })
  return NextResponse.json(data)
})
