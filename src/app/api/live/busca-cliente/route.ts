import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

interface CompraRow {
  id: number
  live_id: number
  cliente_id: number | null
  nome_cliente: string
  whatsapp: string | null
  numero_sacola: string | null
  quantidade_itens: number | null
  quantidade_volumes: number | null
  valor_total: number
  desconto: number | null
  status_compra: string | null
  pagamento_status: string | null
  msg_status: string | null
  link_pagamento: string | null
  data_compra: string | null
  observacoes_compra: string | null
  created_at: string
}

interface ClienteRow {
  id: number
  nome: string
  celular: string | null
  instagram: string | null
  apelido: string | null
  email: string | null
  saldo_credito: number | null
}

interface LiveRow {
  id: number
  titulo: string | null
  data_live: string | null
  status: string | null
  plataforma: string | null
}

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl
  const q      = (searchParams.get("q") ?? "").trim()
  const liveId = searchParams.get("live_id")
  const escopo = searchParams.get("escopo") ?? "esta_live"

  if (q.length < 2) {
    return NextResponse.json({ encontrado: false, compras: [] })
  }

  const sb  = createServerClient()
  const tel = q.replace(/\D/g, "")
  const inst = q.replace(/^@/, "")

  // ── 1. Localizar clientes no cadastro ─────────────────────────────────
  const orCliente = [
    `nome.ilike.%${q}%`,
    tel.length >= 8 ? `celular.ilike.%${tel}%` : null,
    `instagram.ilike.%${inst}%`,
    `apelido.ilike.%${q}%`,
  ].filter(Boolean).join(",")

  const { data: clientesData } = await sb
    .from("clientes")
    .select("id, nome, celular, instagram, apelido, email, saldo_credito")
    .or(orCliente)
    .limit(10)

  const clientes = (clientesData ?? []) as ClienteRow[]
  const clienteIds = clientes.map(c => c.id)

  // ── 2. Buscar compras por nome/whatsapp ───────────────────────────────
  const orNomeWa = [
    `nome_cliente.ilike.%${q}%`,
    tel.length >= 8 ? `whatsapp.ilike.%${tel}%` : null,
  ].filter(Boolean).join(",")

  const COLS =
    "id, live_id, cliente_id, nome_cliente, whatsapp, numero_sacola, " +
    "quantidade_itens, quantidade_volumes, valor_total, desconto, " +
    "status_compra, pagamento_status, msg_status, link_pagamento, " +
    "data_compra, observacoes_compra, created_at"

  let q1 = sb.from("live_compras").select(COLS).or(orNomeWa)
  if (escopo === "esta_live" && liveId) q1 = q1.eq("live_id", parseInt(liveId))
  const { data: porNomeData } = await q1.order("created_at", { ascending: false }).limit(200)
  const porNome = (porNomeData ?? []) as unknown as CompraRow[]

  // ── 3. Buscar compras por cliente_id ──────────────────────────────────
  let porId: CompraRow[] = []
  if (clienteIds.length > 0) {
    let q2 = sb.from("live_compras").select(COLS).in("cliente_id", clienteIds)
    if (escopo === "esta_live" && liveId) q2 = q2.eq("live_id", parseInt(liveId))
    const { data: porIdData } = await q2.order("created_at", { ascending: false }).limit(200)
    porId = (porIdData ?? []) as unknown as CompraRow[]
  }

  // ── 4. Merge + dedup ──────────────────────────────────────────────────
  const seen = new Set<number>()
  const compras: CompraRow[] = []
  for (const c of [...porNome, ...porId]) {
    if (!seen.has(c.id)) { seen.add(c.id); compras.push(c) }
  }

  if (!compras.length) {
    return NextResponse.json({ encontrado: false, compras: [] })
  }

  // ── 5. Buscar lives referenciadas ─────────────────────────────────────
  const liveIds = [...new Set(compras.map(c => c.live_id))]
  const { data: livesData } = await sb
    .from("lives")
    .select("id, titulo, data_live, status, plataforma")
    .in("id", liveIds)
  const livesMap = new Map<number, LiveRow>(((livesData ?? []) as LiveRow[]).map(l => [l.id, l]))

  // ── 6. Dados do cliente ───────────────────────────────────────────────
  const comClienteId = compras.find(c => c.cliente_id)
  let clienteInfo: ClienteRow | null =
    clientes.find(c => c.id === comClienteId?.cliente_id) ?? clientes[0] ?? null

  // ── 7. Resumo ─────────────────────────────────────────────────────────
  const totalValor  = compras.reduce((s, c) => s + (c.valor_total ?? 0), 0)
  const totalPago   = compras.filter(c => c.pagamento_status === "PAGO").reduce((s, c) => s + (c.valor_total ?? 0), 0)
  const totalItens  = compras.reduce((s, c) => s + (c.quantidade_itens ?? 0), 0)
  const retiradas   = compras.filter(c => c.status_compra === "retirada").length
  const agRetirada  = compras.filter(c => c.status_compra === "finalizada").length

  // ── 8. Agrupar por live ───────────────────────────────────────────────
  type LiveGrupo = {
    live_id: number; live_titulo: string; live_data: string | null
    live_status: string | null; live_plataforma: string | null; compras: CompraRow[]
  }
  const livesAgrupadas: LiveGrupo[] = []
  const livesOrdem = new Map<number, number>()

  for (const c of compras) {
    if (!livesOrdem.has(c.live_id)) {
      const l = livesMap.get(c.live_id)
      livesOrdem.set(c.live_id, livesAgrupadas.length)
      livesAgrupadas.push({
        live_id:         c.live_id,
        live_titulo:     l?.titulo ?? `Live #${c.live_id}`,
        live_data:       l?.data_live ?? null,
        live_status:     l?.status ?? null,
        live_plataforma: l?.plataforma ?? null,
        compras:         [],
      })
    }
    livesAgrupadas[livesOrdem.get(c.live_id)!].compras.push(c)
  }

  return NextResponse.json({
    encontrado:   true,
    nome_exibido: clienteInfo?.nome ?? compras[0]?.nome_cliente ?? "Cliente",
    cliente:      clienteInfo,
    resumo: {
      total_lives:       livesAgrupadas.length,
      total_sacolas:     compras.length,
      total_itens:       totalItens,
      total_valor:       totalValor,
      total_pago:        totalPago,
      total_pendente:    totalValor - totalPago,
      retiradas,
      pendentes_retirada: agRetirada,
    },
    lives: livesAgrupadas,
  })
})
