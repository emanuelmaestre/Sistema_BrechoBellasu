import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const sb = createServerClient()
  const { data, error } = await sb.rpc("fn_resumo_financeiro")
  if (error) return NextResponse.json({ erro: "Erro ao buscar resumo." }, { status: 500 })
  return NextResponse.json(data)
}
