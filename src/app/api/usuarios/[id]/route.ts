import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAdminAuth } from "@/lib/with-auth"
import bcrypt from "bcryptjs"
import businessData from "@/data/config/business.json"

export const dynamic = "force-dynamic"

const PERFIS_VALIDOS: string[] = businessData.profiles

export const PATCH = withAdminAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, auth) => {
  const { id } = await params
  const usuarioId = Number(id)
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return NextResponse.json({ erro: "Usuário inválido." }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 })
  }

  if (body.perfil && !PERFIS_VALIDOS.includes(body.perfil)) {
    return NextResponse.json({ erro: `Perfil inválido. Use: ${PERFIS_VALIDOS.join(", ")}.` }, { status: 400 })
  }
  // O admin logado não pode se tirar do admin nem se desativar: ficaria sem acesso.
  if (usuarioId === auth.id && (body.ativo === false || (body.perfil && body.perfil !== "admin"))) {
    return NextResponse.json({ erro: "Você não pode remover seu próprio acesso de administrador." }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.nome)   updates.nome  = body.nome
  if (body.email)  updates.email = String(body.email).toLowerCase().trim()
  if (body.perfil) updates.perfil = body.perfil
  if (body.ativo !== undefined) updates.ativo = body.ativo
  if (body.senha)  updates.senha = await bcrypt.hash(body.senha, 10)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ erro: "Nenhuma alteração informada." }, { status: 400 })
  }

  const sb = createServerClient()
  const { data, error } = await sb
    .from("usuarios")
    .update(updates)
    .eq("id", usuarioId)
    .select("id, nome, email, perfil, ativo")
    .maybeSingle()

  if (error) {
    const duplicado = error.code === "23505"
    return NextResponse.json(
      { erro: duplicado ? "Este e-mail já está em uso por outro usuário." : "Erro ao atualizar usuário." },
      { status: duplicado ? 409 : 500 },
    )
  }
  if (!data) return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 })
  return NextResponse.json(data)
})

export const DELETE = withAdminAuth(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }, auth) => {
  const { id } = await params
  const usuarioId = Number(id)
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return NextResponse.json({ erro: "Usuário inválido." }, { status: 400 })
  }
  if (usuarioId === auth.id) {
    return NextResponse.json({ erro: "Você não pode desativar o seu próprio usuário." }, { status: 400 })
  }
  const sb = createServerClient()

  // Desativar em vez de deletar
  const { data, error } = await sb.from("usuarios").update({ ativo: false }).eq("id", usuarioId).select("id").maybeSingle()
  if (error) return NextResponse.json({ erro: "Erro ao desativar usuário." }, { status: 500 })
  if (!data) return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 })
  return NextResponse.json({ ok: true })
})
