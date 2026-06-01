import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Você precisa estar logado para realizar esta ação." }, { status: 401 })

  const sb = createServerClient()
  const { data } = await sb.from("categorias").select("*").order("nome")
  return NextResponse.json(data ?? [])
}
