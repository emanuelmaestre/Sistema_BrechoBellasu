import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req: NextRequest) => {
  const sb = createServerClient()
  const { data, error } = await sb.from("configuracoes").select("*").eq("chave", "empresa").maybeSingle()
  if (error) return NextResponse.json({ erro: "Não foi possível carregar as configurações. Tente novamente." }, { status: 500 })
  return NextResponse.json(data?.valor ?? {})
})

export const POST = withAuth(async (req: NextRequest) => {
  const valor = await req.json()
  const sb = createServerClient()
  const { data, error } = await sb.from("configuracoes")
    .upsert({ chave: "empresa", valor }, { onConflict: "chave" })
    .select().single()

  if (error) return NextResponse.json({ erro: "Não foi possível salvar as configurações. Tente novamente." }, { status: 500 })
  return NextResponse.json(data)
})
