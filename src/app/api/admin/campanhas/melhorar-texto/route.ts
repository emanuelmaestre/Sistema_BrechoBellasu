import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ erro: "OpenAI não configurada. Adicione OPENAI_API_KEY nas variáveis de ambiente." }, { status: 503 })
  }

  const { texto } = await req.json() as { texto?: string }
  if (!texto?.trim()) {
    return NextResponse.json({ erro: "Texto vazio." }, { status: 400 })
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_CONSENT_MODEL ?? "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: `Você é uma assistente do Brechó Bellasu, uma loja feminina de roupas usadas em Ribeirão Preto/SP.
Sua tarefa é melhorar mensagens de WhatsApp para envio em massa para clientes.

Regras:
- Corrija ortografia e gramática
- Mantenha tom amigável, feminino e próximo (como uma amiga avisando de uma novidade)
- Texto direto e curto, adequado para WhatsApp
- Adicione emojis APENAS onde ficam naturais — no máximo 2 a 3 no total. Se o texto já tem emojis suficientes, não adicione mais
- NÃO invente informações, preços, datas ou detalhes que não estão no texto original
- NÃO adicione saudação (ela é gerada automaticamente pelo sistema)
- Retorne APENAS o texto melhorado, sem explicações, sem aspas, sem prefixos`,
        },
        {
          role: "user",
          content: texto.trim(),
        },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => "")
    return NextResponse.json({ erro: `Erro na OpenAI (${res.status}): ${err.slice(0, 200)}` }, { status: 502 })
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  const resultado = json.choices?.[0]?.message?.content?.trim()
  if (!resultado) {
    return NextResponse.json({ erro: "OpenAI não retornou texto. Tente novamente." }, { status: 502 })
  }

  return NextResponse.json({ texto: resultado })
}
