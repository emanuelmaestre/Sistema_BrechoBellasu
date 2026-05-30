import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get("status")
  const page   = parseInt(searchParams.get("page") ?? "1")
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)
  const from   = (page - 1) * limit
  const to     = from + limit - 1

  const sb = createServerClient()
  let q = sb.from("lives").select("*", { count: "exact" })
  if (status) q = q.eq("status", status)

  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, to)
  if (error) return NextResponse.json({ erro: "Erro ao buscar lives." }, { status: 500 })
  return NextResponse.json({ data, total: count })
}

export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { titulo, data_live, plataforma, tipo, observacoes } = await req.json()
  if (!data_live) return NextResponse.json({ erro: "Data da live é obrigatória." }, { status: 400 })

  const sb = createServerClient()
  const nomeDefault = titulo || `Live ${new Date(data_live + "T12:00:00").toLocaleDateString("pt-BR")}`

  // Tenta inserir com campo tipo; se coluna não existir ainda, insere sem ela
  let data, error
  const withTipo = await sb.from("lives")
    .insert({ titulo: nomeDefault, data_live, plataforma: plataforma || null, tipo: tipo || "novidades", status: "aberta", observacoes: observacoes || null })
    .select().single()

  if (withTipo.error?.message?.includes("tipo")) {
    // Coluna tipo ainda não existe no banco — insere sem ela
    const sem = await sb.from("lives")
      .insert({ titulo: nomeDefault, data_live, plataforma: plataforma || null, status: "aberta", observacoes: observacoes || null })
      .select().single()
    data = sem.data; error = sem.error
  } else {
    data = withTipo.data; error = withTipo.error
  }

  if (error) return NextResponse.json({ erro: "Erro ao criar live.", detalhe: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
