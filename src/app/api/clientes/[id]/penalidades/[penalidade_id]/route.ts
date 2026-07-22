import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

// PATCH /api/clientes/[id]/penalidades/[penalidade_id] — remover penalidade
export const PATCH = withAuth(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; penalidade_id: string }> },
  auth: { id: number; perfil: string }
) => {
  const { penalidade_id } = await params
  const penalidadeId = parseInt(penalidade_id)

  const body = await req.json()
  const motivo_remocao = (body.motivo_remocao as string | undefined) ?? null

  const sb = createServerClient()
  const { data, error } = await sb.rpc("fn_penalidade_remover", {
    p_penalidade_id:  penalidadeId,
    p_motivo_remocao: motivo_remocao,
    p_user_id:        auth.id,
  })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({ id: data })
})
