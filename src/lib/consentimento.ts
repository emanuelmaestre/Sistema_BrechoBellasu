// ══════════════════════════════════════════════════════════
// Mensagem de consentimento LGPD com Small Talk variável
// Parte fixa: lista de serviços + bloco SIM/NÃO
// Parte variável: saudação + apresentação do pedido
// ══════════════════════════════════════════════════════════

// ─── Pools de variação ───────────────────────────────────

const SAUDACOES_CONSENT = [
  (nome: string) => `Oi, ${nome}! 👋`,
  (nome: string) => `Olá, ${nome}! 😊`,
  (nome: string) => `Oi, ${nome}! Tudo bem? 💖`,
  (nome: string) => `Olá, ${nome}! Que bom falar com você. ✨`,
  (nome: string) => `Oi, ${nome}! Passando para um recadinho rápido. 🛍️`,
]

const APRESENTACOES_CONSENT = [
  "O Brechó Bellasu pede sua autorização para enviar mensagens pelo WhatsApp sobre:",
  "Gostaríamos da sua autorização para te enviar mensagens pelo WhatsApp com:",
  "Para continuar te avisando pelo WhatsApp, precisamos da sua autorização para enviar:",
  "O Brechó Bellasu gostaria da sua permissão para te enviar mensagens no WhatsApp sobre:",
  "Para te manter informada pelo WhatsApp, precisamos que você autorize o envio de:",
]

const FECHAMENTOS_CONSENT = [
  "Você pode cancelar quando quiser, é só nos avisar. 😊",
  "Pode cancelar a qualquer momento, basta nos dizer. 💕",
  "Se quiser parar de receber, é só nos avisar. Sem problemas!",
  "A qualquer momento você pode cancelar, é só falar com a gente.",
  "Fica tranquila! Você pode cancelar quando quiser. 💖",
]

const TOTAL_CONSENT = SAUDACOES_CONSENT.length * APRESENTACOES_CONSENT.length * FECHAMENTOS_CONSENT.length // 125

// ─── Pool de rotação ─────────────────────────────────────

let _pool: number[] = []
let _recent: number[] = []

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function refill(excludeRecent: number[]) {
  const all = Array.from({ length: TOTAL_CONSENT }, (_, i) => i)
  _pool = shuffle(all.filter(i => !excludeRecent.includes(i)))
  if (_pool.length === 0) _pool = shuffle(all)
}

export function selectConsentIndex(recentCount = 5): number {
  if (_pool.length === 0) refill(_recent.slice(-recentCount))
  const recent = _recent.slice(-recentCount)
  let candidates = _pool.filter(i => !recent.includes(i))
  if (candidates.length === 0) candidates = _pool
  const chosen = candidates[0]
  _pool = _pool.filter(i => i !== chosen)
  _recent.push(chosen)
  if (_recent.length > TOTAL_CONSENT) _recent.shift()
  return chosen
}

export function resetConsentHistory() {
  _pool = []
  _recent = []
}

// ─── Builder ─────────────────────────────────────────────

function indexToComponents(idx: number) {
  const nA = APRESENTACOES_CONSENT.length
  const nF = FECHAMENTOS_CONSENT.length
  const s = Math.floor(idx / (nA * nF))
  const a = Math.floor((idx % (nA * nF)) / nF)
  const f = idx % nF
  return { s, a, f }
}

export function buildConsentMessage(nome: string, idx?: number): string {
  const primeiroNome = nome.trim().split(/\s+/)[0]
  const chosenIdx = idx ?? selectConsentIndex()
  const { s, a, f } = indexToComponents(chosenIdx)

  const saudacao     = SAUDACOES_CONSENT[s](primeiroNome)
  const apresentacao = APRESENTACOES_CONSENT[a]
  const fechamento   = FECHAMENTOS_CONSENT[f]

  return (
    `${saudacao}\n\n` +
    `${apresentacao}\n\n` +
    `• 🛍️ Novidades, promoções e ofertas exclusivas\n` +
    `• 🎥 Avisos das nossas lives com peças selecionadas\n\n` +
    `${fechamento}\n\n` +
    `Responda:\n` +
    `✅ *SIM* — Autorizo\n` +
    `❌ *NÃO* — Não autorizo`
  )
}

// Mantém retrocompatibilidade com chamadas existentes
function primeiroNomeSeguro(nome: string): string {
  return nome.trim().split(/\s+/)[0] || "cliente"
}

const BLOCO_AUTORIZACAO = `O Brechó Bellasu pede sua autorização para enviar mensagens pelo WhatsApp sobre:

* 🛍️ Novidades, promoções e ofertas exclusivas
* 🎥 Avisos das nossas lives com peças selecionadas

Você pode cancelar quando quiser, é só nos avisar.

Responda:
✅ SIM — Autorizo
❌ NÃO — Não autorizo`

const BLOCO_FOLLOWUP = `Ainda precisamos da sua autorização para te enviar mensagens pelo WhatsApp sobre:

* 🛍️ Novidades, promoções e ofertas exclusivas
* 🎥 Avisos das nossas lives com peças selecionadas

Se preferir não receber, tudo bem também.

Responda:
✅ SIM — Autorizo
❌ NÃO — Não autorizo`

function sanitizarParteIA(texto: string): string {
  return texto
    .replace(/\bSIM\b.*$/gim, "")
    .replace(/\bN[ÃA]O\b.*$/gim, "")
    .replace(/autorizo.*$/gim, "")
    .replace(/```/g, "")
    .trim()
    .slice(0, 280)
}

async function gerarParteIA(nome: string, tipo: "inicial" | "followup"): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const nomeCurto = primeiroNomeSeguro(nome)
  const instrucao = tipo === "followup"
    ? "Crie uma frase curta e educada de follow-up para pedir resposta a uma autorização de WhatsApp ainda pendente."
    : "Crie uma abertura curta e calorosa para pedir autorização de WhatsApp."

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CONSENT_MODEL ?? "gpt-4o-mini",
        temperature: 0.9,
        max_tokens: 90,
        messages: [
          {
            role: "system",
            content: "Voce escreve mensagens curtas em portugues do Brasil para WhatsApp de uma loja chamada Brecho Bellasu. Nao inclua listas, links, SIM, NAO, Autorizo ou texto juridico. Nao use mais de um emoji.",
          },
          {
            role: "user",
            content: `${instrucao} Use o primeiro nome "${nomeCurto}". Retorne somente a frase.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null
    const texto = data?.choices?.[0]?.message?.content
    if (!texto) return null
    const limpo = sanitizarParteIA(texto)
    return limpo.length >= 12 ? limpo : null
  } catch {
    return null
  }
}

export function buildConsentFollowUpMessage(nome: string, idx?: number): string {
  const nomeCurto = primeiroNomeSeguro(nome)
  const chosenIdx = idx ?? selectConsentIndex()
  const { s, f } = indexToComponents(chosenIdx)
  const saudacao = SAUDACOES_CONSENT[s](nomeCurto)
  const fechamento = FECHAMENTOS_CONSENT[f]

  return `${saudacao}\n\nPassando rapidinho para saber se podemos te manter na nossa lista de avisos do WhatsApp. ${fechamento}\n\n${BLOCO_FOLLOWUP}`
}

export async function buildConsentMessageWithAI(nome: string): Promise<string> {
  const parteIA = await gerarParteIA(nome, "inicial")
  if (!parteIA) return buildConsentMessage(nome)
  return `${parteIA}\n\n${BLOCO_AUTORIZACAO}`
}

export async function buildConsentFollowUpMessageWithAI(nome: string): Promise<string> {
  const parteIA = await gerarParteIA(nome, "followup")
  if (!parteIA) return buildConsentFollowUpMessage(nome)
  return `${parteIA}\n\n${BLOCO_FOLLOWUP}`
}

export function MENSAGEM_CONSENTIMENTO(nome: string): string {
  return buildConsentMessage(nome)
}
