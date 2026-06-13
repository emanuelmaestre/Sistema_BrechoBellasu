import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { enviarTexto } from "@/lib/zapi"
import { gerarIntervaloAleatorio } from "@/lib/intervalo-aleatorio"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

type ClienteAviso = {
  id: number
  nome: string
  celular: string
}

function mensagemAviso(tipo: string, link: string) {
  return tipo === "promocional"
    ? `🏷️ Estamos *AO VIVO* com *PROMOÇÕES* agora!\n\nAcesse aqui: ${link}\n\nCorre! 🔥`
    : `✨ Estamos *AO VIVO* com *NOVIDADES* agora!\n\nAcesse aqui: ${link}\n\nTe esperamos! 💖`
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
    .order("nome")

  return ((clientes ?? []) as ClienteAviso[]).filter((c) => !!c.celular)
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

  const clientes = await buscarClientesAviso()
  if (!clientes.length) {
    return NextResponse.json({ ok: true, total: 0, clientes: [], mensagem: "Nenhum cliente com opt-in para lives." })
  }

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

  const mensagem = mensagemAviso((live.tipo ?? "novidades") as string, linkFinal)

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

    const resultado = await enviarTexto(cliente.celular, mensagem, "aviso_live")
    return NextResponse.json({
      id: cliente.id,
      cliente: cliente.nome,
      status: resultado.ok ? "enviado" : "erro",
      messageId: resultado.messageId,
      detalhe: resultado.erro,
    })
  }

  const clientes = await buscarClientesAviso()
  let enviados = 0
  let erros = 0
  let intervaloAnterior: number | undefined

  for (let i = 0; i < clientes.length; i++) {
    if (i > 0) {
      const intervaloMs = gerarIntervaloAleatorio(intervaloAnterior, { minMs: 45_000, maxMs: 120_000, deltaMinMs: 10_000 })
      intervaloAnterior = intervaloMs
      await new Promise((resolve) => setTimeout(resolve, intervaloMs))
    }

    const resultado = await enviarTexto(clientes[i].celular, mensagem, "aviso_live")
    if (resultado.ok) enviados++
    else erros++
  }

  return NextResponse.json({ ok: true, enviados, erros, total: clientes.length })
}
