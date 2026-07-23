import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

export const GET = withAuth(async () => {
  const sb = createServerClient()
  const { data, error } = await sb.rpc("fn_resumo_financeiro")
  if (error) return NextResponse.json({ erro: "Não foi possível carregar o resumo financeiro. Tente novamente." }, { status: 500 })
  return NextResponse.json(data)
})
