import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const { status, decisao_produto, resultado_fin } = await req.json()
  if (!status) return NextResponse.json({ erro: "Status é obrigatório." }, { status: 400 })

  const sb = createServerClient()
  const { data, error } = await sb.rpc("fn_atualizar_status_troca", {
    p_troca_id: parseInt(id),
    p_status: status,
    p_decisao_produto: decisao_produto ?? null,
    p_resultado_fin: resultado_fin ?? null,
  })
  if (error) return NextResponse.json({ erro: "Erro ao atualizar status." }, { status: 500 })
  return NextResponse.json(data)
}
