import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { classificarResposta } from "@/lib/consentimento-resposta"

export const dynamic = "force-dynamic"

// ─── Tipos Z-API ──────────────────────────────────────────
interface ZAPIMessageEvent {
  instanceId?: string
  messageId?:  string
  phone?:      string
  fromMe?:     boolean
  momment?:    number
  status?:     string
  chatName?:   string
  senderPhoto?: string
  senderName?: string
  participantPhone?: string
  photo?:      string
  broadcast?:  boolean
  type?:       string
  text?: { message: string }
  image?: { caption?: string; imageUrl?: string }
  audio?: { audioUrl?: string }
  isStatusReply?: boolean
  isEdit?:     boolean
  isNewsletter?: boolean
}


// Extrai o texto de qualquer tipo de mensagem (texto, legenda de imagem, áudio transcrito)
function extrairTexto(body: ZAPIMessageEvent): string | null {
  // Texto direto
  const t = body.text?.message?.trim()
  if (t) return t
  // Legenda de imagem
  const cap = body.image?.caption?.trim()
  if (cap) return cap
  // Áudio: Z-API envia type="audio" — sem transcrição automática, mas registramos que recebeu áudio
  // para futura análise. Por ora retornamos null para áudio sem texto.
  return null
}

// Gera variantes do número para cobrir formatos diferentes no banco
function gerarVariantesNumero(telefone: string): string[] {
  const variants = new Set<string>()
  variants.add(telefone)

  // Com/sem DDI 55
  const semDDI = telefone.startsWith("55") ? telefone.substring(2) : telefone
  const comDDI = telefone.startsWith("55") ? telefone : `55${telefone}`
  variants.add(semDDI)
  variants.add(comDDI)

  // 9º dígito: adiciona/remove o "9" após o DDD (2 dígitos)
  // Exemplo: 16988XXXXX → 1688XXXXX e vice-versa
  if (semDDI.length === 11) {
    // Tem 9º dígito → tenta sem
    const semNove = semDDI.substring(0, 2) + semDDI.substring(3)
    variants.add(semNove)
    variants.add(`55${semNove}`)
  } else if (semDDI.length === 10) {
    // Não tem 9º dígito → tenta com
    const comNove = semDDI.substring(0, 2) + "9" + semDDI.substring(2)
    variants.add(comNove)
    variants.add(`55${comNove}`)
  }

  return Array.from(variants)
}

// ─── POST — mensagem recebida do cliente ──────────────────
export async function POST(req: NextRequest) {
  try {
    const body: ZAPIMessageEvent = await req.json()

    // Ignora mensagens enviadas por nós
    if (body.fromMe) return NextResponse.json({ ok: true })

    const telefone = (body.phone || "").replace(/\D/g, "")

    // Registra áudio recebido no log (pode ser resposta de consentimento por voz)
    if (body.type === "audio" || body.audio) {
      const sb = createServerClient()
      try {
        await sb.from("whatsapp_log").insert({
          telefone,
          tipo: "recebida_audio",
          mensagem: "[áudio]",
          status: "enviado",
        })
      } catch { /* silencia */ }
      // Áudio sem transcrição: não podemos detectar SIM/NÃO automaticamente
      return NextResponse.json({ ok: true })
    }

    // Ignora eventos sem texto
    const texto = extrairTexto(body)
    if (!texto) return NextResponse.json({ ok: true })

    const sb = createServerClient()

    // Registra no log (silencia se tabela não existir)
    try {
      await sb.from("whatsapp_log").insert({
        telefone,
        tipo: "recebida",
        mensagem: texto.substring(0, 1000),
        status: "enviado",
      })
    } catch { /* silencia */ }

    // ── Processa resposta de consentimento LGPD ──────────
    const classificacao = classificarResposta(texto)
    if (!classificacao) return NextResponse.json({ ok: true })
    const ehSim = classificacao === "sim"

    // Busca cliente por todas as variantes do número (DDI, 9º dígito)
    const telVariantes = gerarVariantesNumero(telefone)

    for (const tel of telVariantes) {
      const { data: cliente } = await sb
        .from("clientes")
        .select("id, notificacao_status, aceita_novidades, aceita_lives")
        .eq("celular", tel)
        .maybeSingle()

      if (!cliente) continue

      // Processa se estava aguardando (enviado) OU ainda em pendente por atraso
      if (cliente.notificacao_status !== "enviado" && cliente.notificacao_status !== "pendente") break

      const novoStatus = ehSim ? "autorizado" : "recusado"
      const novoConsent = ehSim ? "confirmado" : "recusado"

      await sb.from("clientes")
        .update({
          notificacao_status: novoStatus,
          aceita_novidades: novoConsent,
          aceita_lives: novoConsent,
          consentimento_respondido_em: new Date().toISOString(),
        })
        .eq("id", cliente.id)

      // Loga a resposta processada
      try {
        await sb.from("whatsapp_log").insert({
          telefone,
          tipo: ehSim ? "consentimento_autorizado" : "consentimento_recusado",
          mensagem: texto.substring(0, 200),
          status: "enviado",
        })
      } catch { /* silencia */ }

      break
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}

// ─── PUT — confirmação de entrega/envio ───────────────────
export async function PUT(req: NextRequest) {
  try {
    const body: ZAPIMessageEvent = await req.json()

    if (body.messageId && body.status) {
      const sb = createServerClient()
      try {
        await sb.from("live_compras")
          .update({ msg_status: body.status === "DELIVERED" ? "enviada" : body.status?.toLowerCase() })
          .eq("msg_zapi_id", body.messageId)
      } catch { /* silencia */ }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
