import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// GET /api/clientes/[id]/etiquetas
// Histórico de etiquetas emitidas para o cliente, com resumo e filtros.
// Query params: page, per_page, status, de, ate, q
export const GET = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const clienteId = parseInt(id)
    if (!clienteId) return NextResponse.json({ erro: "Cliente inválido." }, { status: 400 })

    const sp = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get("page") ?? "1"))
    const perPage = Math.min(50, Math.max(1, parseInt(sp.get("per_page") ?? "10")))
    const status = sp.get("status") || undefined
    const de = sp.get("de") || undefined
    const ate = sp.get("ate") || undefined
    const q = sp.get("q")?.trim() || undefined

    const sb = createServerClient()

    let query = sb
      .from("etiquetas")
      .select("id, me_order_id, me_protocol, me_tracking, service_id, status, cep_destino, label_url, criado_por, nome_cliente_snapshot, endereco_snapshot, tipo_etiqueta, quantidade_reimpressoes, data_ultima_reimpressao, created_at", { count: "exact" })
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })

    if (status) query = query.eq("status", status)
    if (de) query = query.gte("created_at", de)
    if (ate) query = query.lte("created_at", `${ate}T23:59:59`)
    if (q) query = query.or(`me_protocol.ilike.%${q}%,me_tracking.ilike.%${q}%,nome_cliente_snapshot.ilike.%${q}%`)

    const from = (page - 1) * perPage
    const { data: rows, count, error } = await query.range(from, from + perPage - 1)
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

    // Resolve nomes dos responsáveis (criado_por)
    const userIds = [...new Set((rows ?? []).map(r => r.criado_por).filter(Boolean))] as number[]
    const nomePorId: Record<number, string> = {}
    if (userIds.length > 0) {
      const { data: users } = await sb.from("usuarios").select("id, nome").in("id", userIds)
      for (const u of (users ?? []) as { id: number; nome: string }[]) nomePorId[u.id] = u.nome
    }

    const data = (rows ?? []).map(r => ({
      ...r,
      responsavel: r.criado_por ? (nomePorId[r.criado_por] ?? null) : null,
    }))

    // Resumo: total, última emissão, último endereço (a lista já vem desc)
    const ultima = data[0] ?? null
    const resumo = {
      total_emitidas: count ?? 0,
      ultima_emissao: ultima?.created_at ?? null,
      ultimo_endereco: ultima?.endereco_snapshot ?? null,
    }

    return NextResponse.json({ data, total: count ?? 0, resumo })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível carregar o histórico de etiquetas."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
