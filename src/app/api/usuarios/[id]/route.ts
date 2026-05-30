import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth || auth.perfil !== "admin") return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (body.nome)   updates.nome  = body.nome
  if (body.email)  updates.email = body.email.toLowerCase().trim()
  if (body.perfil) updates.perfil = body.perfil
  if (body.ativo !== undefined) updates.ativo = body.ativo
  if (body.senha)  updates.senha = await bcrypt.hash(body.senha, 10)

  const sb = createServerClient()
  const { data, error } = await sb
    .from("usuarios")
    .update(updates)
    .eq("id", Number(id))
    .select("id, nome, email, perfil, ativo")
    .single()

  if (error) return NextResponse.json({ erro: "Erro ao atualizar usuário." }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth || auth.perfil !== "admin") return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const sb = createServerClient()

  // Desativar em vez de deletar
  const { error } = await sb.from("usuarios").update({ ativo: false }).eq("id", Number(id))
  if (error) return NextResponse.json({ erro: "Erro ao desativar usuário." }, { status: 500 })
  return NextResponse.json({ ok: true })
}
