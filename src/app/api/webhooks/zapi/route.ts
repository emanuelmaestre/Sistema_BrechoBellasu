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

// Palavras que significam SIM
const SIM_WORDS = new Set(["sim", "s", "yes", "y", "quero", "aceito", "claro", "pode"])
const NAO_WORDS = new Set(["nao", "não", "n", "no", "nao quero", "não quero", "recuso", "pare"])

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

    // Registra a mensagem recebida no log
    try {
      await sb.from("whatsapp_log").insert({
        telefone,
        tipo: "recebida",
        mensagem: texto.substring(0, 1000),
        status: "enviado",
      })
    } catch { /* silencia se tabela não existe */ }

    // ── Processa resposta de consentimento LGPD ──
    const textoLower = texto.toLowerCase().trim()
    const ehSim = SIM_WORDS.has(textoLower)
    const ehNao = NAO_WORDS.has(textoLower)

    if (ehSim || ehNao) {
      // Busca cliente pelo telefone (com e sem 55)
      const telVariantes = [telefone]
      if (telefone.startsWith("55")) telVariantes.push(telefone.substring(2))
      else telVariantes.push(`55${telefone}`)

      // Tenta encontrar cliente com consentimento aguardando
      for (const tel of telVariantes) {
        const { data: cliente } = await sb
          .from("clientes")
          .select("id, aceita_novidades, aceita_lives")
          .eq("celular", tel)
          .single()

        if (!cliente) continue

        const updates: Record<string, string> = {}

        // Processa consentimento de novidades (prioridade: novidades primeiro)
        if (cliente.aceita_novidades === "aguardando") {
          updates.aceita_novidades = ehSim ? "confirmado" : "recusado"
        }
        // Processa consentimento de lives
        if (cliente.aceita_lives === "aguardando") {
          updates.aceita_lives = ehSim ? "confirmado" : "recusado"
        }

        if (Object.keys(updates).length > 0) {
          await sb.from("clientes").update(updates).eq("id", cliente.id)
        }
        break
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}

// ─── PUT — Ao enviar (confirmação de entrega/envio) ───────
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
