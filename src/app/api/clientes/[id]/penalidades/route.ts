import { NextRequest, NextResponse } from "next/server"
import {
  grauPenalidade,
  normalizePenalidadeText,
  parseMotivoPenalidade,
  parsePenalidadeId,
} from "@/domain/live/penalidade"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

// GET /api/clientes/[id]/penalidades
export const GET = withAuth(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const clienteId = parsePenalidadeId(id)
  if (!clienteId) {
    return NextResponse.json({ erro: "Cliente invalido." }, { status: 400 })
  }

  const sb = createServerClient()
  const { data: cli, error: clienteError } = await sb
    .from("clientes")
    .select("total_penalidades_ativas")
    .eq("id", clienteId)
    .single()

  if (clienteError || !cli) {
    return NextResponse.json(
      { erro: "Cliente nao encontrado." },
      { status: 404 }
    )
  }

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

  if (error) {
    console.error("[penalidades] Falha ao listar:", error.message)
    return NextResponse.json(
      { erro: "Falha ao carregar penalidades." },
      { status: 500 }
    )
  }

  const totalAtivas = cli.total_penalidades_ativas ?? 0
  return NextResponse.json({
    data: data?.map(p => ({
      ...p,
      criado_por_nome: p.criado_por?.nome ?? null,
      removido_por_nome: p.removido_por?.nome ?? null,
      live_titulo: p.live?.titulo ?? null,
    })) ?? [],
    total: count ?? 0,
    total_ativas: totalAtivas,
    grau: grauPenalidade(totalAtivas),
  })
})

// POST /api/clientes/[id]/penalidades
export const POST = withAuth(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  auth: { id: number; perfil: string }
) => {
  const { id } = await params
  const clienteId = parsePenalidadeId(id)
  if (!clienteId) {
    return NextResponse.json({ erro: "Cliente invalido." }, { status: 400 })
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) {
    return NextResponse.json({ erro: "JSON invalido." }, { status: 400 })
  }

  const motivo = parseMotivoPenalidade(body.motivo)
  if (!motivo) {
    return NextResponse.json({ erro: "Motivo invalido." }, { status: 400 })
  }

  const liveIdInformado = body.live_id !== undefined && body.live_id !== null
  const liveId = liveIdInformado ? parsePenalidadeId(body.live_id) : null
  if (liveIdInformado && !liveId) {
    return NextResponse.json({ erro: "Live invalida." }, { status: 400 })
  }

  const observacao = normalizePenalidadeText(body.observacao)
  if (!observacao.valid) {
    return NextResponse.json(
      { erro: "Observacao invalida ou muito longa." },
      { status: 400 }
    )
  }

  const sb = createServerClient()
  const { data, error } = await sb.rpc("fn_penalidade_entrada", {
    p_cliente_id: clienteId,
    p_live_id: liveId,
    p_motivo: motivo,
    p_obs: observacao.value,
    p_user_id: auth.id,
  })

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { erro: "Esta penalidade ja foi aplicada para a cliente nesta live." },
        { status: 409 }
      )
    }
    if (error.code === "23503" || error.code === "P0001") {
      return NextResponse.json(
        { erro: "Cliente ou live nao encontrados." },
        { status: 404 }
      )
    }
    console.error("[penalidades] Falha ao aplicar:", error.message)
    return NextResponse.json(
      { erro: "Falha ao aplicar penalidade." },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: data }, { status: 201 })
})
