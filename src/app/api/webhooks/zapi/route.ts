import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

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

// Palavras que significam SIM ou NÃO
const SIM_WORDS = new Set(["sim", "s", "yes", "y", "quero", "aceito", "claro", "pode", "autorizo"])
const NAO_WORDS = new Set(["nao", "não", "n", "no", "nao quero", "não quero", "recuso", "pare", "não autorizo", "nao autorizo"])

// ─── POST — mensagem recebida do cliente ──────────────────
export async function POST(req: NextRequest) {
  try {
    const body: ZAPIMessageEvent = await req.json()

    // Ignora mensagens enviadas por nós
    if (body.fromMe) return NextResponse.json({ ok: true })

    // Ignora eventos sem texto
    const texto = body.text?.message?.trim()
    if (!texto) return NextResponse.json({ ok: true })

    const telefone = (body.phone || "").replace(/\D/g, "")

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
    const textoLower = texto.toLowerCase().trim()
    const ehSim = SIM_WORDS.has(textoLower)
    const ehNao = NAO_WORDS.has(textoLower)

    if (!ehSim && !ehNao) return NextResponse.json({ ok: true })

    // Tenta encontrar o cliente pelo telefone (com e sem DDI 55)
    const telVariantes = [telefone]
    if (telefone.startsWith("55")) telVariantes.push(telefone.substring(2))
    else telVariantes.push(`55${telefone}`)

    for (const tel of telVariantes) {
      const { data: cliente } = await sb
        .from("clientes")
        .select("id, notificacao_status, aceita_novidades, aceita_lives")
        .eq("celular", tel)
        .single()

      if (!cliente) continue

      // Só processa se estava aguardando resposta
      if (cliente.notificacao_status !== "enviado") break

      const novoStatus = ehSim ? "autorizado" : "recusado"
      const novoConsent = ehSim ? "confirmado" : "recusado"

      await sb.from("clientes")
        .update({
          notificacao_status: novoStatus,
          aceita_novidades: novoConsent,
          aceita_lives: novoConsent,
        })
        .eq("id", cliente.id)

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
