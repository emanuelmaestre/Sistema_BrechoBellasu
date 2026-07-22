import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { grauPenalidade } from "@/domain/live/penalidade"

export const dynamic = "force-dynamic"

// GET /api/live/penalidades — lista global de clientes com penalidades ativas
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 })

  const sb = createServerClient()

  const { data, error } = await sb
    .from("clientes")
    .select("id, nome, instagram, celular, apelido, total_penalidades_ativas")
    .gt("total_penalidades_ativas", 0)
    .eq("ativo", true)
    .order("total_penalidades_ativas", { ascending: false })
    .order("nome")

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Para cada cliente, busca o último motivo ativo
  const clienteIds = (data ?? []).map(c => c.id)
  let ultimosMotivos: Record<number, string> = {}

  if (clienteIds.length > 0) {
    const { data: pen } = await sb
      .from("penalidades_clientes")
      .select("cliente_id, motivo, created_at")
      .in("cliente_id", clienteIds)
      .eq("status", "ativa")
      .order("created_at", { ascending: false })

    // Pega o motivo mais recente por cliente
    for (const p of pen ?? []) {
      if (!ultimosMotivos[p.cliente_id]) {
        ultimosMotivos[p.cliente_id] = p.motivo
      }
    }
  }

  const result = (data ?? []).map(c => ({
    ...c,
    grau:          grauPenalidade(c.total_penalidades_ativas),
    ultimo_motivo: ultimosMotivos[c.id] ?? null,
  }))

  return NextResponse.json({ data: result, total: result.length })
}
