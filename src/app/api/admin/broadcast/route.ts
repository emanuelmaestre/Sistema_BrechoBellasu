import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { enviarTexto, enviarImagem, enviarVideo } from "@/lib/zapi"
import { buildBroadcastMessage } from "@/lib/broadcast-message-builder"
import { withAdminAuth } from "@/lib/with-auth"
import { getClientIp, rateLimit } from "@/lib/rateLimit"
import { parsePositiveInteger } from "@/lib/campanha-seguranca"

export const dynamic = "force-dynamic"

// Retorna somente clientes ativos que autorizaram campanhas.
export const GET = withAdminAuth(async (req: NextRequest) => {
  const sb = createServerClient()
  const { data, error } = await sb
    .from("clientes")
    .select("id, nome")
    .eq("aceita_novidades", "confirmado")
    .eq("ativo", true)
    .not("celular", "is", null)
    .order("nome")

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  let clientes = data ?? []
  const campanhaIdParam = req.nextUrl.searchParams.get("campanha_id")
  if (campanhaIdParam !== null) {
    const campanhaId = parsePositiveInteger(campanhaIdParam)
    if (!campanhaId) {
      return NextResponse.json({ erro: "campanha_id invalido." }, { status: 400 })
    }

    const { data: processados, error: processadosError } = await sb
      .from("campanha_envios")
      .select("cliente_id")
      .eq("campanha_id", campanhaId)
    if (processadosError) {
      return NextResponse.json({ erro: "Falha ao carregar o progresso." }, { status: 500 })
    }
    const idsProcessados = new Set((processados ?? []).map(item => item.cliente_id))
    clientes = clientes.filter(cliente => !idsProcessados.has(cliente.id))
  }

  const total = clientes.length
  const duracaoMinMin = total <= 1 ? 0 : Math.ceil((total - 1) * 80 / 60)
  const duracaoMinMax = total <= 1 ? 0 : Math.ceil((total - 1) * 150 / 60)

  return NextResponse.json(
    { clientes, total, duracaoMinMin, duracaoMinMax },
    { headers: { "Cache-Control": "no-store" } }
  )
})

// Envia a campanha para um cliente por chamada, com consentimento revalidado.
export const POST = withAdminAuth(async (req: NextRequest, _ctx, auth) => {
  const limit = rateLimit(`broadcast:${auth.id}:${getClientIp(req)}`, 5, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { erro: "Muitas tentativas de envio. Aguarde antes de continuar." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    )
  }

  const body = await req.json().catch(() => null) as {
    campanha_id?: unknown
    cliente_id?: unknown
  } | null
  const campanhaId = parsePositiveInteger(body?.campanha_id)
  const clienteId = parsePositiveInteger(body?.cliente_id)
  if (!campanhaId || !clienteId) {
    return NextResponse.json(
      { erro: "campanha_id e cliente_id sao obrigatorios." },
      { status: 400 }
    )
  }

  const sb = createServerClient()
  const { data: camp, error: campErr } = await sb
    .from("campanhas")
    .select("id,texto,midia_tipo,midia_url,status")
    .eq("id", campanhaId)
    .single()

  if (campErr || !camp) {
    return NextResponse.json({ erro: "Campanha nao encontrada." }, { status: 404 })
  }
  if (camp.status !== "enviando") {
    return NextResponse.json(
      { erro: "A campanha nao esta liberada para envio." },
      { status: 409 }
    )
  }

  const { data: cliente, error: cliErr } = await sb
    .from("clientes")
    .select("id, nome, celular")
    .eq("id", clienteId)
    .eq("aceita_novidades", "confirmado")
    .eq("ativo", true)
    .not("celular", "is", null)
    .single()

  if (cliErr || !cliente) {
    return NextResponse.json(
      {
        status: "erro",
        detalhe: "Cliente sem autorizacao valida para campanhas.",
        cliente: "",
      },
      { status: 422 }
    )
  }

  // A chave unica impede duplicidade ao retomar a campanha ou usar duas abas.
  const { error: reservationError } = await sb.from("campanha_envios").insert({
    campanha_id: campanhaId,
    cliente_id: clienteId,
    status: "processando",
  })
  if (reservationError) {
    if (reservationError.code === "23505") {
      return NextResponse.json(
        {
          status: "ignorada",
          detalhe: "Esta cliente ja foi processada nesta campanha.",
          cliente: cliente.nome,
        },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { erro: "Nao foi possivel reservar o envio." },
      { status: 500 }
    )
  }

  const mensagem = buildBroadcastMessage(cliente.nome, camp.texto)
  let resultado
  if (camp.midia_tipo === "imagem" && camp.midia_url) {
    resultado = await enviarImagem(cliente.celular, camp.midia_url, mensagem, "broadcast")
  } else if (camp.midia_tipo === "video" && camp.midia_url) {
    resultado = await enviarVideo(cliente.celular, camp.midia_url, mensagem, "broadcast")
  } else {
    resultado = await enviarTexto(cliente.celular, mensagem, "broadcast")
  }

  try {
    if (resultado.ok) {
      await sb.rpc("campanha_inc_enviadas", { p_id: campanhaId })
    } else {
      await sb.rpc("campanha_inc_erros", { p_id: campanhaId })
    }
  } catch {
    // O status individual ainda e persistido e retornado ao operador.
  }

  await sb.from("campanha_envios").update({
    status: resultado.ok ? "enviada" : "erro",
    detalhe: (resultado.erro ?? resultado.messageId ?? "").slice(0, 500),
    enviado_em: resultado.ok ? new Date().toISOString() : null,
  }).eq("campanha_id", campanhaId).eq("cliente_id", clienteId)

  return NextResponse.json({
    status: resultado.ok ? "enviada" : "erro",
    detalhe: resultado.erro ?? resultado.messageId ?? "",
    cliente: cliente.nome,
  })
})
