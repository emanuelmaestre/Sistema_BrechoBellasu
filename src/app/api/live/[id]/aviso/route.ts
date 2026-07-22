import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { enviarTexto } from "@/lib/zapi"
import { buildAvisoLive, buildAvisoReenvioLive } from "@/lib/live-message-builder"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

type ClienteAviso = {
  id: number
  nome: string
  celular: string
}

async function buscarLive(liveId: number) {
  const sb = createServerClient()
  const { data: live } = await sb
    .from("lives")
    .select("id, titulo, tipo, status, link_live")
    .eq("id", liveId)
    .single()
  return live
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// GET /api/live/[id]/aviso — retorna compradoras de qualquer live, excluindo
// quem já recebeu este link específico (deduplicação via live_avisos_log).
// A ordem é sempre aleatória (sem prioridade de compradoras recentes).
export async function GET(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const liveId = parseInt(id)
  const link = req.nextUrl.searchParams.get("link") ?? ""

  const live = await buscarLive(liveId)
  if (!live) return NextResponse.json({ erro: "Live não encontrada." }, { status: 404 })
  if (live.status === "encerrada") return NextResponse.json({ erro: "Live já encerrada." }, { status: 400 })

  const sb = createServerClient()

  // Todas as clientes que já compraram em qualquer live (com celular)
  const { data: compraRows } = await sb
    .from("live_compras")
    .select("cliente_id, clientes!inner(id, nome, celular, ativo)")
    .not("cliente_id", "is", null)
    .limit(50_000)

  if (!compraRows?.length) {
    return NextResponse.json({ ok: true, total: 0, clientes: [], mensagem: "Nenhuma compradora encontrada no histórico de lives." })
  }

  // Deduplica por cliente_id e filtra ativas com celular
  const vistas = new Set<number>()
  const candidatas: ClienteAviso[] = []
  type CompraRow = { cliente_id: number; clientes: { id: number; nome: string; celular: string | null; ativo: boolean } | null }
  for (const row of (compraRows as unknown as CompraRow[])) {
    if (!row.cliente_id || vistas.has(row.cliente_id)) continue
    const c = row.clientes
    if (!c || !c.ativo || !c.celular) continue
    vistas.add(row.cliente_id)
    candidatas.push({ id: c.id, nome: c.nome, celular: c.celular })
  }

  if (!candidatas.length) {
    return NextResponse.json({ ok: true, total: 0, clientes: [], mensagem: "Nenhuma compradora ativa com celular encontrada." })
  }

  // Exclui quem já recebeu este link específico nesta live
  const jaEnviadas = new Set<number>()
  if (link) {
    const { data: logRows } = await sb
      .from("live_avisos_log")
      .select("cliente_id")
      .eq("live_id", liveId)
      .eq("link", link)
    for (const r of (logRows ?? []) as { cliente_id: number }[]) {
      jaEnviadas.add(r.cliente_id)
    }
  }

  const pendentes = candidatas.filter(c => !jaEnviadas.has(c.id))

  if (!pendentes.length) {
    return NextResponse.json({ ok: true, total: 0, clientes: [], mensagem: "Todas as compradoras já receberam este link." })
  }

  const fila = shuffleArray(pendentes)

  return NextResponse.json({
    ok: true,
    total: fila.length,
    clientes: fila.map((c) => ({ id: c.id, nome: c.nome })),
  })
}

// POST /api/live/[id]/aviso — envia aviso para uma cliente e registra no log.
export async function POST(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const liveId = parseInt(id)
  const { link, cliente_id, reenvio } = await req.json().catch(() => ({})) as {
    link?: string
    cliente_id?: number
    reenvio?: boolean
  }

  if (!cliente_id) return NextResponse.json({ erro: "cliente_id é obrigatório." }, { status: 400 })

  const sb = createServerClient()
  const live = await buscarLive(liveId)

  if (!live) return NextResponse.json({ erro: "Live não encontrada." }, { status: 404 })
  if (live.status === "encerrada") return NextResponse.json({ erro: "Live já encerrada." }, { status: 400 })

  const linkFinal = link || live.link_live
  if (!linkFinal) return NextResponse.json({ erro: "Link da live é obrigatório." }, { status: 400 })

  if (link) {
    await sb.from("lives").update({ link_live: link }).eq("id", liveId)
  }

  const { data: cliente } = await sb
    .from("clientes")
    .select("id, nome, celular")
    .eq("id", cliente_id)
    .eq("ativo", true)
    .single()

  if (!cliente?.celular) {
    return NextResponse.json({ id: cliente_id, status: "erro", detalhe: "Cliente sem celular ou inativa." })
  }

  const mensagem = reenvio
    ? buildAvisoReenvioLive(cliente.nome, linkFinal)
    : buildAvisoLive(cliente.nome, linkFinal)

  const resultado = await enviarTexto(cliente.celular, mensagem, "aviso_live")

  if (resultado.ok) {
    // Registra envio para deduplicação futura (upsert ignora duplicatas)
    await sb.from("live_avisos_log").upsert(
      { live_id: liveId, cliente_id: cliente.id, link: linkFinal },
      { onConflict: "live_id,cliente_id,link", ignoreDuplicates: true },
    )
  }

  return NextResponse.json({
    id: cliente.id,
    cliente: cliente.nome,
    status: resultado.ok ? "enviado" : "erro",
    messageId: resultado.messageId,
    detalhe: resultado.erro,
  })
}
