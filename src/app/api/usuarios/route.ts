import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req: NextRequest) => {
  const sb = createServerClient()
  const { data, error } = await sb
    .from("usuarios")
    .select("id, nome, email, perfil, ativo, created_at")
    .order("id", { ascending: true })

  if (error) return NextResponse.json({ erro: "Não foi possível carregar os usuários. Tente novamente." }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
})

export const POST = withAuth(async (req: NextRequest, _ctx: unknown, auth: { id: number; perfil: string }) => {
  if (auth.perfil !== "admin") return NextResponse.json({ erro: "Você precisa estar logado para realizar esta ação." }, { status: 401 })

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
    const msg = error.message?.includes("unique") ? "Este e-mail já está em uso por outro usuário." : "Não foi possível criar o usuário. Verifique os dados e tente novamente."
    return NextResponse.json({ erro: msg }, { status: 400 })
  }

  return NextResponse.json(data, { status: 201 })
})
