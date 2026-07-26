import { NextRequest, NextResponse } from "next/server"
import { normalizeCampaignText } from "@/lib/campanha-seguranca"
import { withAdminAuth } from "@/lib/with-auth"
import { getClientIp, rateLimit } from "@/lib/rateLimit"

export const POST = withAdminAuth(async (req: NextRequest, _ctx, auth) => {
  const limit = rateLimit(`campaign-ai:${auth.id}:${getClientIp(req)}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { erro: "Muitas solicitacoes a IA. Aguarde um instante." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    )
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { erro: "A melhoria de texto por IA nao esta configurada." },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => null) as { texto?: unknown } | null
  const texto = normalizeCampaignText(body?.texto)
  if (!texto) {
    return NextResponse.json(
      { erro: "O texto deve ter entre 1 e 800 caracteres." },
      { status: 400 }
    )
  }

  let res: Response
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CONSENT_MODEL ?? "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content: `Voce e uma assistente do Brecho Bellasu, uma loja feminina de roupas usadas em Ribeirao Preto/SP.
Melhore mensagens de WhatsApp para envio em massa.

Regras:
- Corrija ortografia e gramatica
- Mantenha tom amigavel, feminino e proximo
- Mantenha o texto direto e curto
- Use no maximo 2 a 3 emojis naturais
- Nao invente informacoes, precos, datas ou detalhes
- Nao adicione saudacao
- Retorne apenas o texto melhorado`,
          },
          { role: "user", content: texto },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    console.error("[campaign-ai] Falha ao consultar OpenAI:", error)
    return NextResponse.json(
      { erro: "A IA demorou para responder. Tente novamente." },
      { status: 504 }
    )
  }

  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined)
    console.error(`[campaign-ai] OpenAI respondeu com status ${res.status}`)
    return NextResponse.json(
      { erro: "Nao foi possivel melhorar o texto agora." },
      { status: 502 }
    )
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const resultado = normalizeCampaignText(json.choices?.[0]?.message?.content)
  if (!resultado) {
    return NextResponse.json(
      { erro: "A IA nao retornou um texto valido. Tente novamente." },
      { status: 502 }
    )
  }

  return NextResponse.json({ texto: resultado })
})
