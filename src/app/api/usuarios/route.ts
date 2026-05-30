import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const sb = createServerClient()
  const { data, error } = await sb
    .from("usuarios")
    .select("id, nome, email, perfil, ativo, created_at")
    .order("id", { ascending: true })

  if (error) return NextResponse.json({ erro: "Erro ao buscar usuários." }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth || auth.perfil !== "admin") return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const body = await req.json()
  const { nome, email, senha, perfil = "operador" } = body

  if (!nome || !email || !senha) {
    return NextResponse.json({ erro: "Nome, e-mail e senha são obrigatórios." }, { status: 400 })
  }

  const hash = await bcrypt.hash(senha, 10)
  const sb = createServerClient()

  const { data, error } = await sb
    .from("usuarios")
    .insert({ nome, email: email.toLowerCase().trim(), senha: hash, perfil, ativo: true })
    .select("id, nome, email, perfil, ativo")
    .single()

  if (error) {
    const msg = error.message?.includes("unique") ? "E-mail já cadastrado." : "Erro ao criar usuário."
    return NextResponse.json({ erro: msg }, { status: 400 })
  }

  return NextResponse.json(data, { status: 201 })
}
