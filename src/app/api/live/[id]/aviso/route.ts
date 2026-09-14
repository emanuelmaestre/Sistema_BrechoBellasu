import { NextRequest, NextResponse } from "next/server"
import { type SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { enviarTexto } from "@/lib/zapi"
import { buildAvisoLive, buildAvisoReenvioLive } from "@/lib/live-message-builder"
import { ordenarFilaAviso } from "@/lib/aviso-fila"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

type ClienteAviso = {
  id: number
  nome: string
  celular: string | null
  ativo: boolean
  notificacao_status: string | null
  aceita_lives: string | null
}

// O Supabase devolve no máximo 1.000 linhas por consulta, ignorando
// .limit() maior. Pagina até o fim para ninguém ficar de fora da fila.
const PAGINA = 1000
async function buscarTodas<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGINA) return out
  }
}

/**
 * Só recebe aviso de live quem AUTORIZOU (respondeu SIM no consentimento).
 * Quem recusou nunca recebe (LGPD), mesmo que já tenha comprado.
 */
function autorizouLives(c: Pick<ClienteAviso, "notificacao_status" | "aceita_lives">): boolean {
  if (c.notificacao_status === "recusado" || c.aceita_lives === "recusado") return false
  return c.notificacao_status === "autorizado" || c.aceita_lives === "confirmado"
}

async function buscarLive(sb: SupabaseClient, liveId: number) {
  const { data: live } = await sb
    .from("lives")
    .select("id, titulo, tipo, status, link_live, ultimo_aviso_primeiro_cliente_id")
    .eq("id", liveId)
    .single()
  return live
}

// GET /api/live/[id]/aviso — fila do aviso: todas as clientes ativas que
// autorizaram mensagens de live. Compradoras de lives anteriores vêm
// primeiro, depois as demais; cada bloco embaralhado. Exclui quem já
// recebeu este link (live_avisos_log).
export async function GET(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const liveId = parseInt(id)
  const link = req.nextUrl.searchParams.get("link") ?? ""
  const sb = createServerClient()

  const live = await buscarLive(sb, liveId)
  if (!live) return NextResponse.json({ erro: "Live não encontrada." }, { status: 404 })
  if (live.status === "encerrada") return NextResponse.json({ erro: "Live já encerrada." }, { status: 400 })

  let clientes: ClienteAviso[]
  let compras: { cliente_id: number }[]
  try {
    clientes = await buscarTodas<ClienteAviso>((de, ate) =>
      sb.from("clientes")
        .select("id, nome, celular, ativo, notificacao_status, aceita_lives")
        .eq("ativo", true)
        .order("id")
        .range(de, ate))
    compras = await buscarTodas<{ cliente_id: number }>((de, ate) =>
      sb.from("live_compras").select("cliente_id").not("cliente_id", "is", null).order("id").range(de, ate))
  } catch (e) {
    return NextResponse.json({ erro: `Falha ao montar a fila: ${(e as Error).message}` }, { status: 500 })
  }

  const candidatas = clientes.filter((c) => c.celular && autorizouLives(c))
  if (!candidatas.length) {
    return NextResponse.json({ ok: true, total: 0, clientes: [], mensagem: "Nenhuma cliente autorizou receber avisos de live." })
  }

  const jaEnviadas = new Set<number>()
  if (link) {
    const logRows = await buscarTodas<{ cliente_id: number }>((de, ate) =>
      sb.from("live_avisos_log").select("cliente_id").eq("live_id", liveId).eq("link", link).order("id").range(de, ate))
    for (const r of logRows) jaEnviadas.add(r.cliente_id)
  }

  const pendentes = candidatas.filter((c) => !jaEnviadas.has(c.id))
  if (!pendentes.length) {
    return NextResponse.json({ ok: true, total: 0, clientes: [], mensagem: "Todas as clientes autorizadas já receberam este link." })
  }

  const compradoras = new Set(compras.map((c) => c.cliente_id))
  const fila = ordenarFilaAviso(pendentes, compradoras, live.ultimo_aviso_primeiro_cliente_id ?? null)

  await sb.from("lives").update({ ultimo_aviso_primeiro_cliente_id: fila[0].id }).eq("id", liveId)

  return NextResponse.json({
    ok: true,
    total: fila.length,
    clientes: fila.map((c) => ({ id: c.id, nome: c.nome })),
  })
}

// POST /api/live/[id]/aviso — envia o aviso para UMA cliente.
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
  const live = await buscarLive(sb, liveId)

  if (!live) return NextResponse.json({ erro: "Live não encontrada." }, { status: 404 })
  if (live.status === "encerrada") return NextResponse.json({ erro: "Live já encerrada." }, { status: 400 })

  const linkFinal = link || live.link_live
  if (!linkFinal) return NextResponse.json({ erro: "Link da live é obrigatório." }, { status: 400 })

  if (link && link !== live.link_live) {
    await sb.from("lives").update({ link_live: link }).eq("id", liveId)
  }

  const { data: cliente } = await sb
    .from("clientes")
    .select("id, nome, celular, notificacao_status, aceita_lives")
    .eq("id", cliente_id)
    .eq("ativo", true)
    .single()

  if (!cliente?.celular) {
    return NextResponse.json({ id: cliente_id, status: "erro", detalhe: "Cliente sem celular ou inativa." })
  }
  // Revalida no envio: a cliente pode ter recusado depois de a fila ser montada.
  if (!autorizouLives(cliente)) {
    return NextResponse.json({ id: cliente.id, cliente: cliente.nome, status: "ignorada", detalhe: "Cliente não autorizou avisos de live." })
  }

  // Reserva o envio ANTES de mandar: a chave única (live, cliente, link)
  // garante que duas abas/aparelhos não mandem o mesmo aviso duas vezes.
  const { data: reserva, error: erroReserva } = await sb
    .from("live_avisos_log")
    .upsert(
      { live_id: liveId, cliente_id: cliente.id, link: linkFinal },
      { onConflict: "live_id,cliente_id,link", ignoreDuplicates: true },
    )
    .select("id")
  if (erroReserva) {
    return NextResponse.json({ id: cliente.id, cliente: cliente.nome, status: "erro", detalhe: `Falha ao reservar envio: ${erroReserva.message}` })
  }
  if (!reserva?.length) {
    return NextResponse.json({ id: cliente.id, cliente: cliente.nome, status: "ignorada", detalhe: "Já recebeu este link." })
  }

  const mensagem = reenvio
    ? buildAvisoReenvioLive(cliente.nome, linkFinal)
    : buildAvisoLive(cliente.nome, linkFinal)

  let resultado
  try {
    resultado = await enviarTexto(cliente.celular, mensagem, "aviso_live")
  } catch (e) {
    resultado = { ok: false, erro: e instanceof Error ? e.message : String(e), messageId: undefined }
  }

  // Falhou: libera a reserva para a cliente voltar à fila numa retomada.
  if (!resultado.ok) {
    await sb.from("live_avisos_log").delete().eq("id", reserva[0].id)
  }

  return NextResponse.json({
    id: cliente.id,
    cliente: cliente.nome,
    status: resultado.ok ? "enviado" : "erro",
    messageId: resultado.messageId,
    detalhe: resultado.erro,
  })
}
