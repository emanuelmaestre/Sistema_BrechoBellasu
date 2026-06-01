import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Você precisa estar logado para realizar esta ação." }, { status: 401 })

  const sb = createServerClient()
  const { data, error } = await sb.from("configuracoes").select("*").eq("chave", "empresa").maybeSingle()
  if (error) return NextResponse.json({ erro: "Não foi possível carregar as configurações. Tente novamente." }, { status: 500 })
  return NextResponse.json(data?.valor ?? {})
}

export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Você precisa estar logado para realizar esta ação." }, { status: 401 })

  const valor = await req.json()
  const sb = createServerClient()
  const { data, error } = await sb.from("configuracoes")
    .upsert({ chave: "empresa", valor }, { onConflict: "chave" })
    .select().single()

  if (error) return NextResponse.json({ erro: "Não foi possível salvar as configurações. Tente novamente." }, { status: 500 })
  return NextResponse.json(data)
}
