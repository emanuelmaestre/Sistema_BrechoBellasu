// ══════════════════════════════════════════════════════════════════
// LivePurchaseMessageBuilder
// Serviço central de composição de mensagens de compra da live.
// ══════════════════════════════════════════════════════════════════

export const CHAR_LIMIT  = 990   // limite absoluto
export const CHAR_TARGET = 940   // meta de segurança

// ─── Tipos ───────────────────────────────────────────────────────

export interface CompraData {
  data_compra:      string | null
  data_live:        string | null
  numero_sacola:    string | null | undefined
  cor_sacola:       string | null | undefined
  quantidade_itens: number | null | undefined
  valor_total:      number | null | undefined
  nome_cliente:     string | null | undefined
  link_pagamento?:  string | null
}

export type SmallTalkLevel = "COMPLETO" | "MEDIO" | "CURTO" | "FALLBACK"

export interface MessageResult {
  mensagem:       string
  chars:          number
  bytes:          number
  level:          SmallTalkLevel
  smallTalkIndex: number  // índice da combinação usada
  valida:         boolean
  erro?:          string
}

// ─── Utilitários ────────────────────────────────────────────────

export function countCharacters(s: string): number {
  return [...s].length  // conta code points (emojis = 1)
}

export function countUtf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length
}

function fmtData(d: string | null): string {
  if (!d) return "—"
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR")
}

function fmtVal(v: unknown): string {
  return "R$ " + parseFloat(String(v ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
}

export function prazo48h(): string {
  const dias = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"]
  const d = new Date()
  d.setHours(d.getHours() + 48)
  return dias[d.getDay()]
}

export function validateCustomerName(nome: string | null | undefined): string | null {
  if (!nome) return null
  const n = nome.trim()
  if (!n) return null
  if (/^\d+$/.test(n)) return null
  if (/[<>{}[\]\\]/.test(n)) return null
  const lower = n.toLowerCase()
  const invalidos = ["cliente", "sem nome", "não informado", "nao informado", "teste", "user"]
  if (invalidos.some(i => lower === i)) return null
  // Não usa se parecer username do Instagram (sem espaço, muitos números ou underscores)
  if (/^[a-z0-9_.]+$/.test(lower) && !lower.includes(" ")) return null
  return n
}

// ─── Biblioteca de variações ─────────────────────────────────────

const SAUDACOES = [
  (nome: string | null) => nome ? `Olá, ${nome.split(" ")[0]}! Tudo bem? 💖` : "Olá! Tudo bem? 💖",
  (nome: string | null) => nome ? `Oi, ${nome.split(" ")[0]}! Como você está? ✨` : "Oi! Como você está? ✨",
  (_: string | null)    => "Olá! Esperamos que esteja tudo bem por aí. 💕",
  (nome: string | null) => nome ? `Oi, ${nome.split(" ")[0]}! Que bom falar com você. 💖` : "Oi! Que bom falar com você. 💖",
  (_: string | null)    => "Olá! Passando com carinho para falar da sua compra. 🛍️",
]

const AGRADECIMENTOS = [
  "Foi muito bom ter você com a gente em mais uma live!",
  "Adoramos ter sua participação em nossa live!",
  "Obrigada por acompanhar e participar da nossa live!",
  "Ficamos muito felizes com a sua participação!",
  "Foi um prazer ter você com a gente durante a live!",
]

const CONFIRMACOES = [
  "Suas peças foram separadas com muito carinho. 🛍️",
  "Suas escolhas já estão separadas para você. 💖",
  "Suas peças estão reservadas e organizadas com carinho.",
  "Já deixamos suas peças separadinhas para você. 🛍️",
  "Suas peças foram cuidadosamente separadas.",
]

// Total de combinações = 5 × 5 × 5 = 125
const TOTAL_COMBINACOES = SAUDACOES.length * AGRADECIMENTOS.length * CONFIRMACOES.length

// Estado de rotação em memória (servidor)
let _unusedPool: number[] = []   // combinações ainda não usadas neste ciclo
let _recentUsed: number[] = []   // últimas N usadas (anti-repetição imediata)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function refillPool(excludeRecent: number[]): void {
  const all = Array.from({ length: TOTAL_COMBINACOES }, (_, i) => i)
  _unusedPool = shuffle(all.filter(i => !excludeRecent.includes(i)))
  // Se todos estão nos recentes (pool muito pequeno), usa todos
  if (_unusedPool.length === 0) _unusedPool = shuffle(all)
}

export function resetSmallTalkHistory() {
  _unusedPool = []
  _recentUsed = []
}

function comboIndexToComponents(idx: number) {
  const nA = AGRADECIMENTOS.length
  const nC = CONFIRMACOES.length
  const s = Math.floor(idx / (nA * nC))
  const a = Math.floor((idx % (nA * nC)) / nC)
  const c = idx % nC
  return { s, a, c }
}

export function selectSmallTalkIndex(recentCount = 5): number {
  // Garante pool inicializado
  if (_unusedPool.length === 0) refillPool(_recentUsed.slice(-recentCount))

  // Remove da pool itens recentes (anti-repetição consecutiva)
  const recent = _recentUsed.slice(-recentCount)
  let candidates = _unusedPool.filter(i => !recent.includes(i))

  // Fallback: se todos os restantes são recentes, usa o mais antigo do pool
  if (candidates.length === 0) candidates = _unusedPool

  const chosen = candidates[0]
  _unusedPool = _unusedPool.filter(i => i !== chosen)

  _recentUsed.push(chosen)
  if (_recentUsed.length > TOTAL_COMBINACOES) _recentUsed.shift()

  return chosen
}

// ─── Construtores de blocos ──────────────────────────────────────

export function buildSmallTalk(level: SmallTalkLevel, nome: string | null, idx: number): string {
  if (level === "FALLBACK") {
    return "Olá! 💖 Obrigada por participar da nossa live! Suas peças já estão separadas. 🛍️"
  }

  const { s, a, c } = comboIndexToComponents(idx)
  const saudacao    = SAUDACOES[s](nome)
  const agradec     = AGRADECIMENTOS[a]
  const confirmacao = CONFIRMACOES[c]

  if (level === "CURTO") {
    return `${saudacao} ${agradec} ${confirmacao}`
  }
  if (level === "MEDIO") {
    return `${saudacao}\n\n${agradec} ${confirmacao}`
  }
  // COMPLETO
  return `${saudacao}\n\n${agradec} ${confirmacao}`
}

export function buildFixedContent(compra: CompraData, diaPrazo: string): string {
  const num = compra.numero_sacola
    ? String(compra.numero_sacola).padStart(2, "0")
    : "—"
  const qtd = compra.quantidade_itens ?? 1
  const qtdLabel = Number(qtd) === 1 ? "ITEM" : "ITENS"

  const blocoPagemento = compra.link_pagamento
    ? `💳 Link de pagamento (PIX ou cartão):
${compra.link_pagamento}

O pagamento deve ser realizado até ${diaPrazo}, às 23h59, para manter suas peças reservadas. 💖`
    : `O pagamento deve ser realizado até ${diaPrazo}, às 23h59, via PIX, para manter suas peças reservadas. 💖

🔑 PIX: (16) 99134-7476
👤 Nome: Emanuel Maestre dos Santos`

  return `📅 Data da compra: ${fmtData(compra.data_compra)}
🎥 Data da live: ${fmtData(compra.data_live)}
🛍️ Nº da sacola: ${num}
🎨 Cor da sacola: ${compra.cor_sacola || "—"}
📦 Quantidade de itens: ${qtd} ${qtdLabel}
💰 Valor total das compras: ${fmtVal(compra.valor_total)}

Pagamento:

${blocoPagemento}

End. p/ retirada:

📍 R. Barão do Amazonas, 1035 – Centro – Rib. Preto/SP

⚠️ ATENÇÃO:

Para entrega, envie o endereço completo apenas se for diferente do cadastrado. A taxa é de R$ 15,00. 🛵

É NECESSÁRIO TER ALGUÉM NO LOCAL PARA RECEBER. CASO CONTRÁRIO, SERÁ COBRADA UMA NOVA TAXA.

VOCÊ TAMBÉM PODE OPTAR PELA RETIRADA OU ENTREGA POR CONTA PRÓPRIA.

⚠️ IMPORTANTE:

Peças de promoção não possuem troca.

Obrigada pela compra! Esperamos que você ame suas peças. Até a próxima live! 💖`
}

export function validateMessageLimit(mensagem: string): { valida: boolean; erro?: string } {
  const chars = countCharacters(mensagem)
  if (chars > CHAR_LIMIT) {
    return { valida: false, erro: `A mensagem ultrapassou o limite de ${CHAR_LIMIT} caracteres (atual: ${chars}).` }
  }
  return { valida: true }
}

// ─── Builder principal ───────────────────────────────────────────

export function buildCompleteMessage(compra: CompraData, idx?: number): MessageResult {
  const diaPrazo    = prazo48h()
  const nomeValido  = validateCustomerName(compra.nome_cliente)
  const fixedBlock  = buildFixedContent(compra, diaPrazo)
  const fixedChars  = countCharacters(fixedBlock)
  const chosenIdx   = idx ?? selectSmallTalkIndex()

  // Determina o nível de small talk que cabe dentro do limite
  const levels: SmallTalkLevel[] = ["COMPLETO", "MEDIO", "CURTO", "FALLBACK"]

  for (const level of levels) {
    const smallTalk = buildSmallTalk(level, nomeValido, chosenIdx)
    const mensagem  = `${smallTalk}\n\n${fixedBlock}`
    const chars     = countCharacters(mensagem)

    if (chars <= CHAR_LIMIT) {
      return {
        mensagem,
        chars,
        bytes:          countUtf8Bytes(mensagem),
        level,
        smallTalkIndex: chosenIdx,
        valida:         true,
      }
    }
  }

  // Se chegou aqui, até o fallback ultrapassou o limite (dados extremos)
  const fallback  = buildSmallTalk("FALLBACK", null, chosenIdx)
  const mensagem  = `${fallback}\n\n${fixedBlock}`
  const chars     = countCharacters(mensagem)

  return {
    mensagem,
    chars,
    bytes:          countUtf8Bytes(mensagem),
    level:          "FALLBACK",
    smallTalkIndex: chosenIdx,
    valida:         chars <= CHAR_LIMIT,
    erro:           chars > CHAR_LIMIT
      ? `A mensagem ultrapassou o limite de ${CHAR_LIMIT} caracteres (atual: ${chars}). Revise o conteúdo antes de enviar.`
      : undefined,
  }
}

export function selectSmallTalkByAvailableLength(
  compra: CompraData,
  idx: number,
): SmallTalkLevel {
  const diaPrazo   = prazo48h()
  const fixedBlock = buildFixedContent(compra, diaPrazo)
  const fixedChars = countCharacters(fixedBlock)
  const available  = CHAR_LIMIT - fixedChars - 2 // -2 para "\n\n"

  const levels: SmallTalkLevel[] = ["COMPLETO", "MEDIO", "CURTO", "FALLBACK"]
  for (const level of levels) {
    const nomeValido = validateCustomerName(compra.nome_cliente)
    const st = buildSmallTalk(level, nomeValido, idx)
    if (countCharacters(st) <= available) return level
  }
  return "FALLBACK"
}

// ─── Idempotência ────────────────────────────────────────────────

export function generateNotificationId(liveId: number, compraId: number): string {
  return `live_${liveId}_compra_${compraId}_aviso_live`
}
