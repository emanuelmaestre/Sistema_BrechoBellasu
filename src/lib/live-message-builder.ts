// ══════════════════════════════════════════════════════════════════
// LivePurchaseMessageBuilder
// Serviço central de composição de mensagens de compra da live.
// ══════════════════════════════════════════════════════════════════

export const CHAR_LIMIT  = 990
export const CHAR_TARGET = 940

// ─── Tipos ───────────────────────────────────────────────────────

export interface ProdutoMensagem {
  nome:     string
  marca?:   string | null
  cor?:     string | null
  tamanho?: string | null
  preco:    number
}

export interface CompraData {
  data_compra:             string | null
  data_live:               string | null
  numero_sacola:           string | null | undefined
  quantidade_itens:        number | null | undefined
  valor_total:             number | null | undefined
  desconto?:               number | null
  nome_cliente:            string | null | undefined
  chave_pix?:              string | null  // chave PIX manual para pagamento
  credito_aplicado?:       number | null
  pago_com_credito?:       boolean        // true = crédito quitou tudo
  saldo_credito_anterior?: number | null
  produtos?:               ProdutoMensagem[]
}

export type SmallTalkLevel = "COMPLETO" | "MEDIO" | "CURTO" | "FALLBACK"

export interface MessageResult {
  mensagem:       string
  chars:          number
  bytes:          number
  level:          SmallTalkLevel
  smallTalkIndex: number
  valida:         boolean
  erro?:          string
}

// ─── Utilitários ─────────────────────────────────────────────────

export function countCharacters(s: string): number { return [...s].length }

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

export function prazoPagamento(dataLive: string | null): string {
  const base = dataLive ? new Date(dataLive + "T12:00:00") : new Date()
  base.setDate(base.getDate() + 2)
  return base.toLocaleDateString("pt-BR")
}

/** @deprecated use prazoPagamento(dataLive) */
export function prazo48h(): string { return prazoPagamento(null) }

export function validateCustomerName(nome: string | null | undefined): string | null {
  if (!nome) return null
  const n = nome.trim()
  if (!n) return null
  if (/^\d+$/.test(n)) return null
  if (/[<>{}[\]\\]/.test(n)) return null
  const lower = n.toLowerCase()
  const invalidos = ["cliente", "sem nome", "não informado", "nao informado", "teste", "user"]
  if (invalidos.some(i => lower === i)) return null
  if (/^[a-z0-9_.]+$/.test(lower) && !lower.includes(" ")) return null
  return n
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Small Talk — mensagens de compra da live ────────────────────
// 18 saudações × 12 agradecimentos × 12 confirmações = 2.592 combinações

const SAUDACOES: Array<(n: string | null) => string> = [
  n => n ? `Oi, ${n.split(" ")[0]}! Que bom falar com você. 💖`             : "Oi! Que bom falar com você. 💖",
  n => n ? `Oi, ${n.split(" ")[0]}! Tudo bem com você? 😊`                  : "Oi! Tudo bem com você? 😊",
  n => n ? `Olá, ${n.split(" ")[0]}! Que alegria falar com você! 😍`         : "Olá! Que alegria falar com você! 😍",
  n => n ? `Oi, ${n.split(" ")[0]}! Estava pensando em você! 💖`             : "Oi! Estava pensando em você! 💖",
  n => n ? `Olá, ${n.split(" ")[0]}! Que bom te ver por aqui! ✨`            : "Olá! Que bom te ver por aqui! ✨",
  n => n ? `Ei, ${n.split(" ")[0]}! Passando com novidade especial! 🎉`      : "Ei! Passando com novidade especial! 🎉",
  n => n ? `Oi, ${n.split(" ")[0]}! Saudades! Tô aqui com seu recado. 🥰`   : "Oi! Saudades! Tô aqui com seu recado. 🥰",
  n => n ? `Olá, ${n.split(" ")[0]}! Você é especial pra gente! 🌸`          : "Olá! Você é especial pra gente! 🌸",
  n => n ? `Oi, ${n.split(" ")[0]}! Vim com carinho te dar um recado. 💌`    : "Oi! Vim com carinho te dar um recado. 💌",
  n => n ? `Ei, ${n.split(" ")[0]}! Feliz em falar com você hoje! 🥰`        : "Ei! Feliz em falar com você hoje! 🥰",
  n => n ? `Olá, ${n.split(" ")[0]}! Passando com muito carinho! 💕`         : "Olá! Passando com muito carinho! 💕",
  n => n ? `Oi, ${n.split(" ")[0]}! Que bom que você esteve com a gente! ✨` : "Oi! Que bom que você esteve com a gente! ✨",
  n => n ? `Ei, ${n.split(" ")[0]}! Tô super feliz de falar com você! 🎀`   : "Ei! Tô super feliz de falar com você! 🎀",
  n => n ? `Olá, ${n.split(" ")[0]}! Vim com uma novidade linda pra você! 🛍️`: "Olá! Vim com uma novidade linda pra você! 🛍️",
  n => n ? `Oi, ${n.split(" ")[0]}! Você faz parte dessa história com a gente! 💖`: "Oi! Você faz parte dessa história com a gente! 💖",
  n => n ? `Ei, ${n.split(" ")[0]}! Que dia especial por ter você! 🌟`       : "Ei! Que dia especial por ter você! 🌟",
  n => n ? `Olá, ${n.split(" ")[0]}! Tô aqui com muito amor pra contar. 💗` : "Olá! Tô aqui com muito amor pra contar. 💗",
  n => n ? `Oi, ${n.split(" ")[0]}! Sempre um prazer falar com você! 😊`     : "Oi! Sempre um prazer falar com você! 😊",
]

const AGRADECIMENTOS: string[] = [
  "Foi um prazer ter você com a gente durante a live!",
  "Ficamos muito felizes com a sua participação na live!",
  "Adoramos ter você com a gente em mais uma live!",
  "Obrigada por acompanhar e participar da nossa live!",
  "Foi lindo ter você com a gente durante a live!",
  "Sua presença na live foi muito especial pra gente!",
  "Que alegria ter você participando da nossa live!",
  "Foi um momento muito especial ter você com a gente!",
  "Obrigada de coração por participar da live!",
  "Sua participação na live foi muito importante pra gente!",
  "Que emoção ter você na live mais uma vez!",
  "Você faz nossa live ainda mais especial! Obrigada! 💖",
]

const CONFIRMACOES: string[] = [
  "Suas peças foram cuidadosamente separadas.",
  "Suas escolhas já estão separadas com muito carinho.",
  "Suas peças foram reservadas e organizadas com amor.",
  "Já deixamos suas peças separadinhas esperando por você.",
  "Suas peças estão reservadas e prontas pra você!",
  "Com muito cuidado, separamos suas peças com amor. 🛍️",
  "Suas peças estão organizadas com todo o carinho.",
  "Cada peça foi separada com muito capricho pra você.",
  "Suas peças já estão reservadas e guardadas com carinho. 💕",
  "Tudo separadinho e organizado esperando por você! 🛍️",
  "Suas peças estão safe e esperando por você com amor. 💖",
  "Fizemos questão de separar suas peças com muito cuidado.",
]

const TOTAL_COMBINACOES = SAUDACOES.length * AGRADECIMENTOS.length * CONFIRMACOES.length

let _unusedPool: number[] = []
let _recentUsed: number[] = []

function refillPool(excludeRecent: number[]): void {
  const all = Array.from({ length: TOTAL_COMBINACOES }, (_, i) => i)
  _unusedPool = shuffle(all.filter(i => !excludeRecent.includes(i)))
  if (_unusedPool.length === 0) _unusedPool = shuffle(all)
}

export function resetSmallTalkHistory() { _unusedPool = []; _recentUsed = [] }

function comboIndexToComponents(idx: number) {
  const nA = AGRADECIMENTOS.length
  const nC = CONFIRMACOES.length
  const s = Math.floor(idx / (nA * nC))
  const a = Math.floor((idx % (nA * nC)) / nC)
  const c = idx % nC
  return { s, a, c }
}

export function selectSmallTalkIndex(recentCount = 8): number {
  if (_unusedPool.length === 0) refillPool(_recentUsed.slice(-recentCount))
  const recent = _recentUsed.slice(-recentCount)
  let candidates = _unusedPool.filter(i => !recent.includes(i))
  if (candidates.length === 0) candidates = _unusedPool
  const chosen = candidates[0]
  _unusedPool = _unusedPool.filter(i => i !== chosen)
  _recentUsed.push(chosen)
  if (_recentUsed.length > TOTAL_COMBINACOES) _recentUsed.shift()
  return chosen
}

export function buildSmallTalk(level: SmallTalkLevel, nome: string | null, idx: number): string {
  if (level === "FALLBACK") {
    return "Olá! 💖 Obrigada por participar da nossa live! Suas peças já estão separadas. 🛍️"
  }
  const { s, a, c } = comboIndexToComponents(idx)
  const saudacao    = SAUDACOES[s](nome)
  const agradec     = AGRADECIMENTOS[a]
  const confirmacao = CONFIRMACOES[c]
  if (level === "CURTO") return `${saudacao} ${agradec} ${confirmacao}`
  return `${saudacao}\n\n${agradec} ${confirmacao}`
}

export function selectSmallTalkByAvailableLength(compra: CompraData, idx: number): SmallTalkLevel {
  const dataPrazo = prazoPagamento(compra.data_live)
  const nome      = validateCustomerName(compra.nome_cliente)
  const levels: SmallTalkLevel[] = ["COMPLETO", "MEDIO", "CURTO", "FALLBACK"]
  // Calcula com a variante que buildCompleteMessage vai usar: tenta com produtos, cai para sem
  const variantes: CompraData[] = compra.produtos && compra.produtos.length > 0
    ? [compra, { ...compra, produtos: [] }]
    : [compra]
  for (const variante of variantes) {
    const fixedBlock = buildFixedContent(variante, dataPrazo)
    const available  = CHAR_LIMIT - countCharacters(fixedBlock) - 2
    for (const level of levels) {
      if (countCharacters(buildSmallTalk(level, nome, idx)) <= available) return level
    }
  }
  return "FALLBACK"
}

// ─── Aviso de Live (transmissão ao vivo) ─────────────────────────

const AVISO_ABERTURAS: Array<(n: string | null) => string> = [
  n => n ? `Oi, ${n.split(" ")[0]}! Tudo bem com você? 😊` : "Oi! Tudo bem com você? 😊",
  n => n ? `Oi, ${n.split(" ")[0]}! Saudades! 🥰` : "Oi! Saudades! 🥰",
  n => n ? `Olá, ${n.split(" ")[0]}! Que bom te ver por aqui! ✨` : "Olá! Que bom te ver por aqui! ✨",
  n => n ? `Ei, ${n.split(" ")[0]}! Tô passando rapidinho... 🏃‍♀️💨` : "Ei! Tô passando rapidinho... 🏃‍♀️💨",
  n => n ? `Oi, ${n.split(" ")[0]}! Estava pensando em você! 💖` : "Oi! Estava pensando em você! 💖",
  n => n ? `Olá, ${n.split(" ")[0]}! Passando com novidade! 🎉` : "Olá! Passando com novidade! 🎉",
  n => n ? `Ei, ${n.split(" ")[0]}! Tem coisa boa aqui pra você! 🛍️` : "Ei! Tem coisa boa aqui pra você! 🛍️",
  n => n ? `Oi, ${n.split(" ")[0]}! Vim te dar um recado especial! 💌` : "Oi! Vim te dar um recado especial! 💌",
  n => n ? `Oi, ${n.split(" ")[0]}! Você é especial pra gente! 🌸` : "Oi! Você é especial pra gente! 🌸",
  n => n ? `Olá, ${n.split(" ")[0]}! Que alegria falar com você! 😍` : "Olá! Que alegria falar com você! 😍",
]

const AVISO_CHAMADAS: string[] = [
  "🔴 A propósito, estamos *AO VIVO* agora e tem coisa especial esperando por você! 🎉✨",
  "🔴 A live tá *bombando* e você não pode ficar de fora! Coisas incríveis aqui! 🔥",
  "✨ Tem *novidade especial* te esperando na live agora! Entra lá! 🎉",
  "🛍️ A live começou e as peças tão *voando*! Vem antes que acabe! 🔴",
  "🎉 Estamos *AO VIVO* com peças lindas e promoções imperdíveis! Não perde! 💖",
  "🔴 Nossa live começou agora e está *cheia de surpresas* pra você! ✨🛍️",
  "💥 Peças novas, preços incríveis e a gente *AO VIVO* agora! Vem! 🔴🎉",
  "✨ Estamos *AO VIVO* agora com seleção especial e muito amor! 💖🔴",
  "🔴 A live abriu e já tem muita coisa bonita passando! Não perde! 🛍️✨",
  "🎀 Estamos *AO VIVO* com peças garimpadas com muito carinho pra você! 🔴💖",
  "🔴 Começo de live e as melhores peças aparecem primeiro! Corre! 🔥🛍️",
  "💫 Estamos *AO VIVO* agora! Tem peça boa, preço justo e muito estilo! 🔴✨",
]

const AVISO_FECHAMENTOS: Array<(link: string) => string> = [
  link => `Corre lá: ${link}\n\nTe esperamos! 🙌🏼❤️`,
  link => `Entra aqui agora: ${link}\n\nA gente tá te esperando! 💖`,
  link => `Vem com a gente: ${link}\n\nTe esperamos com muita alegria! 🎉`,
  link => `Acessa agora: ${link}\n\nTe esperamos lá! 🔴✨`,
  link => `Tô te esperando: ${link}\n\nVem! 🛍️💖`,
  link => `Entra aqui: ${link}\n\nÉ rapidinho e vale muito! 💫`,
  link => `Acessa agora e vem se surpreender: ${link}\n\n❤️`,
  link => `Passa lá: ${link}\n\nTem coisa linda esperando por você! 🌸`,
]

const AVISO_TOTAL = AVISO_ABERTURAS.length * AVISO_CHAMADAS.length * AVISO_FECHAMENTOS.length
let _avisoUnusedPool: number[] = []
const _avisoRecentUsed: number[] = []

function refillAvisoPool(excludeRecent: number[]): void {
  const all = Array.from({ length: AVISO_TOTAL }, (_, i) => i)
  _avisoUnusedPool = shuffle(all.filter(i => !excludeRecent.includes(i)))
  if (_avisoUnusedPool.length === 0) _avisoUnusedPool = shuffle(all)
}

function selectAvisoIndex(): number {
  if (_avisoUnusedPool.length === 0) refillAvisoPool(_avisoRecentUsed.slice(-8))
  const recent = _avisoRecentUsed.slice(-8)
  let candidates = _avisoUnusedPool.filter(i => !recent.includes(i))
  if (candidates.length === 0) candidates = _avisoUnusedPool
  const chosen = candidates[0]
  _avisoUnusedPool = _avisoUnusedPool.filter(i => i !== chosen)
  _avisoRecentUsed.push(chosen)
  if (_avisoRecentUsed.length > AVISO_TOTAL) _avisoRecentUsed.shift()
  return chosen
}

export function buildAvisoLive(nome: string | null, link: string): string {
  const idx = selectAvisoIndex()
  const nC  = AVISO_CHAMADAS.length
  const nF  = AVISO_FECHAMENTOS.length
  const a   = Math.floor(idx / (nC * nF))
  const c   = Math.floor((idx % (nC * nF)) / nF)
  const f   = idx % nF
  const nomeValido = validateCustomerName(nome)
  return `${AVISO_ABERTURAS[a](nomeValido)}\n\n${AVISO_CHAMADAS[c]}\n\n${AVISO_FECHAMENTOS[f](link)}`
}

// ─── Bloco fixo da mensagem de compra ────────────────────────────

export function buildFixedContent(compra: CompraData, dataPrazo: string): string {
  const num = compra.numero_sacola
    ? String(compra.numero_sacola).padStart(2, "0")
    : "—"
  const qtd      = compra.quantidade_itens ?? 1
  const qtdLabel = Number(qtd) === 1 ? "ITEM" : "ITENS"

  const desconto    = parseFloat(String(compra.desconto ?? 0))
  const temDesconto = desconto > 0
  const credito     = parseFloat(String(compra.credito_aplicado ?? 0))
  const temCredito  = credito > 0
  const valorFinal  = Math.max(0, parseFloat(String(compra.valor_total ?? 0)) - desconto - credito)

  const linhasValor = [`💰 Valor Total: ${fmtVal(compra.valor_total)}`]
  if (temDesconto) linhasValor.push(`🏷️ Desconto: − ${fmtVal(desconto)}`)
  if (temCredito)  linhasValor.push(`🎁 Crédito utilizado: − ${fmtVal(credito)}`)
  if (temDesconto || temCredito) linhasValor.push(`✅ Valor final a pagar: ${fmtVal(valorFinal)}`)
  const blocoValor = linhasValor.join("\n")

  let blocoPagamento: string
  let blocoDeadline = `⏰ Pague até ${dataPrazo} às 23h59 via PIX para garantir suas peças. 💖`

  if (compra.pago_com_credito) {
    blocoPagamento = `✅ Esta compra foi quitada com o seu saldo de crédito.
Crédito utilizado: ${fmtVal(credito)}
Saldo restante: R$ 0,00`
    blocoDeadline = "Nenhum valor a pagar. 💖"
  } else if (compra.chave_pix) {
    blocoPagamento = `🔑 Chave PIX: ${compra.chave_pix}`
  } else {
    blocoPagamento = `[ CHAVE PIX NÃO INFORMADA ]`
  }

  const blocoProdutos = ""

  const dataUnificada = fmtData(compra.data_compra ?? compra.data_live)

  return `📅 LIVE/COMPRA: ${dataUnificada}
🛍️ Sacola: ${num} | QT: ${qtd} ${qtdLabel}
${blocoValor}${blocoProdutos}

Pagamento:

${blocoPagamento}

${blocoDeadline}

📍 Retirada: R. Barão do Amazonas, 1035 – Centro – Rib. Preto/SP
🛵 Entrega: R$ 15,00 (Rib. Preto) | Outras cidades a combinar
⚠️ Promoção não tem troca. Obrigada! Até a próxima! 💖`
}

export function validateMessageLimit(mensagem: string): { valida: boolean; erro?: string } {
  const chars = countCharacters(mensagem)
  if (chars > CHAR_LIMIT) {
    return { valida: false, erro: `A mensagem ultrapassou o limite de ${CHAR_LIMIT} caracteres (atual: ${chars}).` }
  }
  return { valida: true }
}

// ─── Builder principal ────────────────────────────────────────────

export function buildCompleteMessage(compra: CompraData, idx?: number): MessageResult {
  const dataPrazo  = prazoPagamento(compra.data_live)
  const nomeValido = validateCustomerName(compra.nome_cliente)
  const chosenIdx  = idx ?? selectSmallTalkIndex()
  const levels: SmallTalkLevel[] = ["COMPLETO", "MEDIO", "CURTO", "FALLBACK"]

  // Tenta primeiro com produtos, depois sem — garante que o limite seja respeitado
  const variantes: CompraData[] = compra.produtos && compra.produtos.length > 0
    ? [compra, { ...compra, produtos: [] }]
    : [compra]

  for (const variante of variantes) {
    const fixedBlock = buildFixedContent(variante, dataPrazo)
    for (const level of levels) {
      const smallTalk = buildSmallTalk(level, nomeValido, chosenIdx)
      const mensagem  = `${smallTalk}\n\n${fixedBlock}`
      const chars     = countCharacters(mensagem)
      if (chars <= CHAR_LIMIT) {
        return { mensagem, chars, bytes: countUtf8Bytes(mensagem), level, smallTalkIndex: chosenIdx, valida: true }
      }
    }
  }

  // Último recurso: sem produtos + FALLBACK (nunca deveria chegar aqui)
  const fixedBlock = buildFixedContent({ ...compra, produtos: [] }, dataPrazo)
  const fallback   = buildSmallTalk("FALLBACK", null, chosenIdx)
  const mensagem   = `${fallback}\n\n${fixedBlock}`
  const chars      = countCharacters(mensagem)
  return {
    mensagem, chars,
    bytes:          countUtf8Bytes(mensagem),
    level:          "FALLBACK",
    smallTalkIndex: chosenIdx,
    valida:         chars <= CHAR_LIMIT,
    erro:           chars > CHAR_LIMIT
      ? `A mensagem ultrapassou o limite de ${CHAR_LIMIT} caracteres (atual: ${chars}).`
      : undefined,
  }
}

// ─── Idempotência ─────────────────────────────────────────────────

export function generateNotificationId(liveId: number, compraId: number): string {
  return `live_${liveId}_compra_${compraId}_aviso_live`
}
