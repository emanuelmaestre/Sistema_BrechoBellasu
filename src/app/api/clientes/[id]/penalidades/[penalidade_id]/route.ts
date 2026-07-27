import { NextRequest, NextResponse } from "next/server"
import {
  normalizePenalidadeText,
  parsePenalidadeId,
} from "@/domain/live/penalidade"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

// PATCH /api/clientes/[id]/penalidades/[penalidade_id]
export const PATCH = withAuth(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; penalidade_id: string }> },
  auth: { id: number; perfil: string }
) => {
  const { id, penalidade_id } = await params
  const clienteId = parsePenalidadeId(id)
  const penalidadeId = parsePenalidadeId(penalidade_id)
  if (!clienteId || !penalidadeId) {
    return NextResponse.json(
      { erro: "Cliente ou penalidade invalidos." },
      { status: 400 }
    )
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) {
    return NextResponse.json({ erro: "JSON invalido." }, { status: 400 })
  }

  const motivoRemocao = normalizePenalidadeText(body.motivo_remocao)
  if (!motivoRemocao.valid) {
    return NextResponse.json(
      { erro: "Motivo de remocao invalido ou muito longo." },
      { status: 400 }
    )
  }

  const sb = createServerClient()
  const { data, error } = await sb.rpc("fn_penalidade_remover", {
    p_penalidade_id: penalidadeId,
    p_cliente_id: clienteId,
    p_motivo_remocao: motivoRemocao.value,
    p_user_id: auth.id,
  })

  if (error) {
    if (error.code === "P0001") {
      return NextResponse.json(
        { erro: "Penalidade ativa nao encontrada para esta cliente." },
        { status: 404 }
      )
    }
    console.error("[penalidades] Falha ao remover:", error.message)
    return NextResponse.json(
      { erro: "Falha ao remover penalidade." },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: data })
})
