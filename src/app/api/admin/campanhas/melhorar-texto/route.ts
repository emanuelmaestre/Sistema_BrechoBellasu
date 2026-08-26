import { NextRequest, NextResponse } from "next/server"
import { normalizeCampaignText } from "@/lib/campanha-seguranca"
import { withAdminAuth } from "@/lib/with-auth"
import { getClientIp, rateLimit } from "@/lib/rateLimit"

const MODELO_PADRAO = "gpt-4o-mini"

/** Remove aspas, espacos e quebras de linha que vazam de variaveis de ambiente coladas no painel. */
const limpaEnv = (value: string) =>
  value.replace(/[^\x21-\x7E]/g, "").replace(/^["']+|["']+$/g, "")

const PROMPT_SISTEMA = `Voce e uma assistente do Brecho Bellasu, uma loja feminina de roupas usadas em Ribeirao Preto/SP.
Melhore mensagens de WhatsApp para envio em massa.

Regras:
- Corrija ortografia e gramatica
- Mantenha tom amigavel, feminino e proximo
- Mantenha o texto direto e curto
- Use no maximo 2 a 3 emojis naturais
- Nao invente informacoes, precos, datas ou detalhes
- Nao adicione saudacao
- Retorne apenas o texto melhorado`

export const POST = withAdminAuth(async (req: NextRequest, _ctx, auth) => {
  const limit = rateLimit(`campaign-ai:${auth.id}:${getClientIp(req)}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { erro: "Muitas solicitacoes a IA. Aguarde um instante." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    )
  }

  const apiKey = limpaEnv(process.env.OPENAI_API_KEY ?? "")
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

  const modeloConfigurado = limpaEnv(process.env.OPENAI_CONSENT_MODEL ?? "") || MODELO_PADRAO

  const chamar = (modelo: string) =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelo,
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          { role: "system", content: PROMPT_SISTEMA },
          { role: "user", content: texto },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    })

  let modelo = modeloConfigurado
  let res: Response
  try {
    res = await chamar(modelo)
    // Modelo configurado indisponivel para a conta: tenta o padrao antes de desistir.
    if ((res.status === 404 || res.status === 400) && modelo !== MODELO_PADRAO) {
      const detalhe = await res.text().catch(() => "")
      console.error(`[campaign-ai] Modelo "${modelo}" recusado (${res.status}): ${detalhe.slice(0, 300)}`)
      modelo = MODELO_PADRAO
      res = await chamar(modelo)
    }
  } catch (error) {
    console.error("[campaign-ai] Falha ao consultar OpenAI:", error)
    return NextResponse.json(
      { erro: "A IA demorou para responder. Tente novamente." },
      { status: 504 }
    )
  }

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "")
    const codigo = (() => {
      try {
        return (JSON.parse(detalhe) as { error?: { code?: string } }).error?.code ?? ""
      } catch {
        return ""
      }
    })()
    console.error(
      `[campaign-ai] OpenAI respondeu ${res.status} (modelo ${modelo}): ${detalhe.slice(0, 500)}`
    )

    const erro =
      res.status === 401 || res.status === 403
        ? "A chave da OpenAI foi recusada. Confira a OPENAI_API_KEY nas variaveis de ambiente."
        : codigo === "insufficient_quota"
          ? "A conta da OpenAI esta sem creditos. Recarregue para usar a IA."
          : res.status === 429
            ? "A IA esta sobrecarregada. Tente de novo em alguns segundos."
            : res.status === 404 || res.status === 400
              ? `O modelo "${modelo}" nao esta disponivel nesta conta da OpenAI.`
              : "Nao foi possivel melhorar o texto agora."

    return NextResponse.json({ erro }, { status: 502 })
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
