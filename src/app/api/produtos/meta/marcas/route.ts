import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const busca = req.nextUrl.searchParams.get("busca") ?? ""
  const sb = createServerClient()

  let q = sb.from("marcas").select("id, nome").order("nome")
  if (busca.length >= 1) q = q.ilike("nome", `%${busca}%`)

  const { data, error } = await (busca.length >= 1 ? q.limit(10) : q.limit(500))
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { nome } = await req.json()
  if (!nome?.trim()) return NextResponse.json({ erro: "Nome obrigatório." }, { status: 400 })

  const sb = createServerClient()

  // Verifica se já existe (case-insensitive)
  const { data: existing } = await sb
    .from("marcas")
    .select("id, nome")
    .ilike("nome", nome.trim())
    .limit(1)
    .single()

  if (existing) return NextResponse.json(existing, { status: 200 })

  const { data, error } = await sb
    .from("marcas")
    .insert({ nome: nome.trim().toUpperCase() })
    .select()
    .single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
