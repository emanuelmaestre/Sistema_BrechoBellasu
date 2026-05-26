import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

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

// ─── POST — Ao receber (mensagem recebida do cliente) ─────
export async function POST(req: NextRequest) {
  try {
    const body: ZAPIMessageEvent = await req.json()

    // Ignora mensagens enviadas por nós mesmos
    if (body.fromMe) return NextResponse.json({ ok: true })

    // Ignora eventos sem texto
    const texto = body.text?.message?.trim()
    if (!texto) return NextResponse.json({ ok: true })

    const telefone = (body.phone || "").replace(/\D/g, "")
    const nome     = body.senderName || body.chatName || "Cliente"

    const sb = createServerClient()

    // Registra a mensagem recebida no histórico (tabela whatsapp_mensagens)
    try {
      await sb.from("whatsapp_mensagens").insert({
        telefone,
        nome_contato: nome,
        mensagem:     texto,
        direcao:      "recebida",
        evento:       "ao_receber",
        payload:      body,
      })
    } catch { /* silencia se tabela ainda não existe */ }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}

// ─── PUT — Ao enviar (confirmação de entrega/envio) ───────
export async function PUT(req: NextRequest) {
  try {
    const body: ZAPIMessageEvent = await req.json()

    // Atualiza status da mensagem na live_compras se houver messageId
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
