import { createServerClient } from "@/lib/supabase"
import { dispararTextoUnico } from "@/lib/disparo-controlado"
import {
  buildConsentFollowUpMessageWithAI,
  buildConsentMessageWithAI,
} from "@/lib/consentimento"

type ConsentimentoTipo = "inicial" | "followup"

export async function enviarConsentimentoCliente(params: {
  clienteId: number
  nome: string
  celular: string
  tipo?: ConsentimentoTipo
}) {
  const tipo = params.tipo ?? "inicial"
  const sb = createServerClient()
  const agora = new Date().toISOString()
  const mensagem = tipo === "followup"
    ? await buildConsentFollowUpMessageWithAI(params.nome)
    : await buildConsentMessageWithAI(params.nome)

  await sb.from("clientes")
    .update({
      aceita_novidades: "aguardando",
      aceita_lives: "aguardando",
      notificacao_status: "pendente",
    })
    .eq("id", params.clienteId)

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
