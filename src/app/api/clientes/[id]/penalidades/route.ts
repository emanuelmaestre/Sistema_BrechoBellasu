import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { grauPenalidade } from "@/domain/live/penalidade"

export const dynamic = "force-dynamic"

// GET /api/clientes/[id]/penalidades
export const GET = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const clienteId = parseInt(id)
  const sb = createServerClient()

  const { data: cli } = await sb
    .from("clientes")
    .select("total_penalidades_ativas")
    .eq("id", clienteId)
    .single()

  const { data, count, error } = await sb
    .from("penalidades_clientes")
    .select(`
      *,
      criado_por:criado_por_id(nome),
      removido_por:removido_por_id(nome),
      live:live_id(titulo)
    `, { count: "exact" })
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  const total_ativas = cli?.total_penalidades_ativas ?? 0

  return NextResponse.json({
    data: data?.map(p => ({
      ...p,
      criado_por_nome:   p.criado_por?.nome ?? null,
      removido_por_nome: p.removido_por?.nome ?? null,
      live_titulo:       p.live?.titulo ?? null,
    })) ?? [],
    total: count ?? 0,
    total_ativas,
    grau: grauPenalidade(total_ativas),
  })
})

// POST /api/clientes/[id]/penalidades
export const POST = withAuth(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  auth: { id: number; perfil: string }
) => {
  const { id } = await params
  const clienteId = parseInt(id)

  const body = await req.json()
  const motivo    = body.motivo as string
  const live_id   = body.live_id ? Number(body.live_id) : null
  const observacao = body.observacao as string | undefined ?? null

  const motivos = ["nao_pagou_prazo", "desistiu_apos_contemplar"]
  if (!motivos.includes(motivo)) {
    return NextResponse.json({ erro: "Motivo inválido." }, { status: 400 })
  }

  const sb = createServerClient()
  const { data, error } = await sb.rpc("fn_penalidade_entrada", {
    p_cliente_id: clienteId,
    p_live_id:    live_id,
    p_motivo:     motivo,
    p_obs:        observacao,
    p_user_id:    auth.id,
  })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({ id: data }, { status: 201 })
})
