import { NextResponse } from "next/server"
import { grauPenalidade } from "@/domain/live/penalidade"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

// GET /api/live/penalidades
export const GET = withAuth(async () => {
  const sb = createServerClient()
  const { data, error } = await sb
    .from("clientes")
    .select("id, nome, instagram, celular, apelido, total_penalidades_ativas")
    .gt("total_penalidades_ativas", 0)
    .eq("ativo", true)
    .order("total_penalidades_ativas", { ascending: false })
    .order("nome")

  if (error) {
    console.error("[penalidades-live] Falha ao listar clientes:", error.message)
    return NextResponse.json(
      { erro: "Falha ao carregar clientes penalizadas." },
      { status: 500 }
    )
  }

  const clienteIds = (data ?? []).map(cliente => cliente.id)
  const ultimosMotivos: Record<number, string> = {}
  if (clienteIds.length > 0) {
    const { data: penalidades, error: penalidadesError } = await sb
      .from("penalidades_clientes")
      .select("cliente_id, motivo, created_at")
      .in("cliente_id", clienteIds)
      .eq("status", "ativa")
      .order("created_at", { ascending: false })

    if (penalidadesError) {
      console.error(
        "[penalidades-live] Falha ao carregar motivos:",
        penalidadesError.message
      )
      return NextResponse.json(
        { erro: "Falha ao carregar detalhes das penalidades." },
        { status: 500 }
      )
    }

    for (const penalidade of penalidades ?? []) {
      if (!ultimosMotivos[penalidade.cliente_id]) {
        ultimosMotivos[penalidade.cliente_id] = penalidade.motivo
      }
    }
  }

  const result = (data ?? []).map(cliente => ({
    ...cliente,
    grau: grauPenalidade(cliente.total_penalidades_ativas),
    ultimo_motivo: ultimosMotivos[cliente.id] ?? null,
  }))

  return NextResponse.json({ data: result, total: result.length })
})
