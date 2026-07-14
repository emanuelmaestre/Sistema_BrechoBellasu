import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { enviarTexto } from "@/lib/zapi"
import { gerarIntervaloAleatorio } from "@/lib/intervalo-aleatorio"
import { buildAvisoLive } from "@/lib/live-message-builder"
import { ordenarFilaAviso } from "@/lib/aviso-fila"

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

async function buscarClientesAviso(): Promise<ClienteAviso[]> {
  const sb = createServerClient()
  const { data: clientes } = await sb
    .from("clientes")
    .select("id, nome, celular")
    .eq("aceita_lives", "confirmado")
    .eq("ativo", true)
    .not("celular", "is", null)

  return ((clientes ?? []) as ClienteAviso[]).filter((c) => !!c.celular)
}

// Conjunto de cliente_id que já compraram em QUALQUER live (histórico em
// live_compras). Define quem entra no bloco prioritário do aviso.
async function buscarCompradorasIds(sb: ReturnType<typeof createServerClient>): Promise<Set<number>> {
  const { data } = await sb.from("live_compras").select("cliente_id").not("cliente_id", "is", null)
  const ids = new Set<number>()
  for (const row of (data ?? []) as { cliente_id: number | null }[]) {
    if (typeof row.cliente_id === "number") ids.add(row.cliente_id)
  }
  return ids
}

// Monta a fila de envio do aviso: compradoras (embaralhadas) + demais
// (embaralhadas), sem repetir a 1ª cliente do disparo anterior. Faz o IO
// (buscar compradoras, ler/gravar a 1ª anterior) e delega a ordenação para a
// função pura ordenarFilaAviso. Degrada com elegância se a coluna de controle
// ainda não existir no banco.
async function montarFilaAviso(liveId: number, clientes: ClienteAviso[]): Promise<ClienteAviso[]> {
  const sb = createServerClient()
  const compradoras = await buscarCompradorasIds(sb)

  // 1ª cliente do disparo anterior (null se coluna ausente ou nunca disparado)
  const anterior = await sb.from("lives").select("ultimo_aviso_primeiro_cliente_id").eq("id", liveId).single()
  const ultimoPrimeiro = anterior.error
    ? null
    : ((anterior.data as Record<string, unknown> | null)?.ultimo_aviso_primeiro_cliente_id ?? null) as number | null

  const fila = ordenarFilaAviso(clientes, compradoras, ultimoPrimeiro)

  // Registra a nova 1ª cliente (ignora silenciosamente se a coluna não existir)
  if (fila.length > 0) {
    await sb.from("lives").update({ ultimo_aviso_primeiro_cliente_id: fila[0].id }).eq("id", liveId)
  }

  return fila
}

// GET /api/live/[id]/aviso — lista clientes elegiveis para o front orquestrar
// o envio sem rajadas nem timeout de servidor.
export async function GET(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const liveId = parseInt(id)
  const live = await buscarLive(liveId)

  if (!live) return NextResponse.json({ erro: "Live não encontrada." }, { status: 404 })
  if (live.status === "encerrada") return NextResponse.json({ erro: "Live já encerrada." }, { status: 400 })

  const clientesBase = await buscarClientesAviso()
  if (!clientesBase.length) {
    return NextResponse.json({ ok: true, total: 0, clientes: [], mensagem: "Nenhum cliente com opt-in para lives." })
  }

  const clientes = await montarFilaAviso(liveId, clientesBase)

  return NextResponse.json({
    ok: true,
    total: clientes.length,
    clientes: clientes.map((c) => ({ id: c.id, nome: c.nome })),
  })
}

// POST /api/live/[id]/aviso — envia um aviso. Preferencialmente recebe
// { link, cliente_id } para processar uma cliente por chamada. Sem cliente_id,
// mantém fallback legado em modo sequencial conservador.
export async function POST(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const liveId = parseInt(id)
  const { link, cliente_id } = await req.json().catch(() => ({})) as { link?: string; cliente_id?: number }

  const sb = createServerClient()
  const live = await buscarLive(liveId)

  if (!live) return NextResponse.json({ erro: "Live não encontrada." }, { status: 404 })
  if (live.status === "encerrada") return NextResponse.json({ erro: "Live já encerrada." }, { status: 400 })

  const linkFinal = link || live.link_live
  if (!linkFinal) return NextResponse.json({ erro: "Link da live é obrigatório." }, { status: 400 })

  if (link) {
    await sb.from("lives").update({ link_live: link }).eq("id", liveId)
  }

  if (cliente_id) {
    const { data: cliente } = await sb
      .from("clientes")
      .select("id, nome, celular")
      .eq("id", cliente_id)
      .eq("aceita_lives", "confirmado")
      .eq("ativo", true)
      .single()

    if (!cliente?.celular) {
      return NextResponse.json({ id: cliente_id, status: "erro", detalhe: "Cliente sem opt-in ou sem celular." })
    }

    const mensagem = buildAvisoLive(cliente.nome, linkFinal)
    const resultado = await enviarTexto(cliente.celular, mensagem, "aviso_live")
    return NextResponse.json({
      id: cliente.id,
      cliente: cliente.nome,
      status: resultado.ok ? "enviado" : "erro",
      messageId: resultado.messageId,
      detalhe: resultado.erro,
    })
  }

  const clientes = await montarFilaAviso(liveId, await buscarClientesAviso())
  let enviados = 0
  let erros = 0
  let intervaloAnterior: number | undefined

  for (let i = 0; i < clientes.length; i++) {
    if (i > 0) {
      const intervaloMs = gerarIntervaloAleatorio(intervaloAnterior, { minMs: 80_000, maxMs: 150_000, deltaMinMs: 10_000 })
      intervaloAnterior = intervaloMs
      await new Promise((resolve) => setTimeout(resolve, intervaloMs))
    }

    const mensagem = buildAvisoLive(clientes[i].nome, linkFinal)
    const resultado = await enviarTexto(clientes[i].celular, mensagem, "aviso_live")
    if (resultado.ok) enviados++
    else erros++
  }

  return NextResponse.json({ ok: true, enviados, erros, total: clientes.length })
}
