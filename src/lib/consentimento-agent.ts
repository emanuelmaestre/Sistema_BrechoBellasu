import { createServerClient } from "@/lib/supabase"
import { dispararTextoUnico } from "@/lib/disparo-controlado"
import {
  buildConsentFollowUpMessageWithAI,
  buildConsentMessageWithAI,
} from "@/lib/consentimento"
import { gerarIntervaloAleatorio } from "@/lib/intervalo-aleatorio"

type ConsentimentoTipo = "inicial" | "followup"
type ConsentimentoResultado = Awaited<ReturnType<typeof dispararTextoUnico>> & {
  skipped?: boolean
  motivo?: string
}

const CONSENTIMENTO_INTERVALO_SEGURO = {
  minMs: 45_000,
  maxMs: 120_000,
  deltaMinMs: 10_000,
}

let filaConsentimento = Promise.resolve()
let ultimoEnvioConsentimentoMs = 0
let ultimoIntervaloConsentimentoMs: number | undefined

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function enviarConsentimentoCliente(params: {
  clienteId: number
  nome: string
  celular: string
  tipo?: ConsentimentoTipo
}): Promise<ConsentimentoResultado> {
  const tipo = params.tipo ?? "inicial"
  const sb = createServerClient()
  const agora = new Date().toISOString()
  const mensagem = tipo === "followup"
    ? await buildConsentFollowUpMessageWithAI(params.nome)
    : await buildConsentMessageWithAI(params.nome)

  let reserva = sb.from("clientes")
    .update({
      aceita_novidades: "aguardando",
      aceita_lives: "aguardando",
      notificacao_status: "pendente",
    })
    .eq("id", params.clienteId)
    .select("id")

  if (tipo === "followup") {
    reserva = reserva
      .eq("notificacao_status", "enviado")
      .eq("aceita_novidades", "aguardando")
      .eq("aceita_lives", "aguardando")
  } else {
    reserva = reserva.or("notificacao_status.is.null,notificacao_status.eq.erro")
  }

  const { data: reservado, error: reservaError } = await reserva
  if (reservaError) return { ok: false, erro: reservaError.message }
  if (!reservado?.length) {
    return {
      ok: true,
      skipped: true,
      motivo: "Consentimento ja reservado, enviado, autorizado ou recusado para este cliente.",
    }
  }

  const resultado = await dispararTextoUnico({
    clienteId: params.clienteId,
    nome: params.nome,
    telefone: params.celular,
    mensagem,
    tipo: "consentimento",
    modulo: "CLIENTES",
  })

  if (!resultado.ok) {
    await sb.from("clientes")
      .update({
        aceita_novidades: "nao",
        aceita_lives: "nao",
        notificacao_status: "erro",
      })
      .eq("id", params.clienteId)
    return resultado
  }

  const patch: Record<string, unknown> = {
    notificacao_status: "enviado",
    consentimento_enviado_em: agora,
  }

  if (tipo === "followup") {
    patch.consentimento_followup_em = agora
    patch.consentimento_followup_count = 1
  }

  await sb.from("clientes")
    .update(patch)
    .eq("id", params.clienteId)

  return resultado
}

export async function orquestrarEnvioConsentimentoCliente(params: {
  clienteId: number
  nome: string
  celular: string
  tipo?: ConsentimentoTipo
}) {
  const tarefa = filaConsentimento.then(async () => {
    if (ultimoEnvioConsentimentoMs > 0) {
      const intervaloMs = gerarIntervaloAleatorio(
        ultimoIntervaloConsentimentoMs,
        CONSENTIMENTO_INTERVALO_SEGURO,
      )
      ultimoIntervaloConsentimentoMs = intervaloMs

      const decorridoMs = Date.now() - ultimoEnvioConsentimentoMs
      const esperaMs = Math.max(0, intervaloMs - decorridoMs)
      if (esperaMs > 0) await sleep(esperaMs)
    }

    const resultado = await enviarConsentimentoCliente(params)
    ultimoEnvioConsentimentoMs = Date.now()
    return resultado
  })

  filaConsentimento = tarefa.then(() => undefined, () => undefined)
  return tarefa
}
