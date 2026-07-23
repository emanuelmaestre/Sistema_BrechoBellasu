import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

export const GET = withAuth(async () => {
  const sb = createServerClient()
  const { data } = await sb.from("categorias").select("*").order("nome")
  return NextResponse.json(data ?? [])
})
