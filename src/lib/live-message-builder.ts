import liveMessageData from "@/data/messages/live.json"

const SAUDACOES = liveMessageData.greetings
const AVISO_ABERTURAS = liveMessageData.announcementOpenings
const AVISO_FECHAMENTOS = liveMessageData.announcementClosings

function renderNamedTemplate(
  template: { withValue: string; withoutValue: string },
  value: string | null,
): string {
  const selected = value ? template.withValue : template.withoutValue
  const firstName = value?.trim().split(/\s+/)[0] ?? ""
  return selected.replace("{nome}", firstName)
}

const AGRADECIMENTOS = liveMessageData.thanks
const CONFIRMACOES = liveMessageData.confirmations
const AVISO_CHAMADAS = liveMessageData.announcementCalls
const AVISO_REENVIO_CHAMADAS = liveMessageData.reminderCalls
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

export function prazoPagamento(dataLive: string | null, dias = 2): string {
  const base = dataLive ? new Date(dataLive + "T12:00:00") : new Date()
  base.setDate(base.getDate() + dias)
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
  const saudacao    = renderNamedTemplate(SAUDACOES[s], nome)
  const agradec     = AGRADECIMENTOS[a]
  const confirmacao = CONFIRMACOES[c]
  if (level === "CURTO") return `${saudacao} ${agradec} ${confirmacao}`
  return `${saudacao}\n\n${agradec} ${confirmacao}`
}

export function selectSmallTalkByAvailableLength(compra: CompraData, idx: number, diasPrazo = 2): SmallTalkLevel {
  const dataPrazo = prazoPagamento(compra.data_live, diasPrazo)
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
  return `${renderNamedTemplate(AVISO_ABERTURAS[a], nomeValido)}\n\n${AVISO_CHAMADAS[c]}\n\n${AVISO_FECHAMENTOS[f].replace("{link}", link)}`
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
  // Pedido de comprovante faz parte das instruções de pagamento — some junto
  // com o prazo quando a compra é quitada 100% com crédito (nada a pagar).
  let blocoDeadline = `💝 Suas peças estão reservadas com muito carinho, esperando só por você!
Pague até ${dataPrazo} às 23h59 via PIX para confirmá-las. 🛍️✨
📎 Após o pagamento, é só enviar o comprovante aqui e a gente cuida do resto! Agradecemos de coração. 🙏💖`

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

export function buildCompleteMessage(compra: CompraData, idx?: number, diasPrazo = 2): MessageResult {
  const dataPrazo  = prazoPagamento(compra.data_live, diasPrazo)
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

const AVISO_REENVIO_TOTAL = AVISO_ABERTURAS.length * AVISO_REENVIO_CHAMADAS.length * AVISO_FECHAMENTOS.length
let _avisoReenvioUnusedPool: number[] = []
const _avisoReenvioRecentUsed: number[] = []

function refillReenvioPool(excludeRecent: number[]): void {
  const all = Array.from({ length: AVISO_REENVIO_TOTAL }, (_, i) => i)
  _avisoReenvioUnusedPool = shuffle(all.filter(i => !excludeRecent.includes(i)))
  if (_avisoReenvioUnusedPool.length === 0) _avisoReenvioUnusedPool = shuffle(all)
}

function selectReenvioIndex(): number {
  if (_avisoReenvioUnusedPool.length === 0) refillReenvioPool(_avisoReenvioRecentUsed.slice(-8))
  const recent = _avisoReenvioRecentUsed.slice(-8)
  let candidates = _avisoReenvioUnusedPool.filter(i => !recent.includes(i))
  if (candidates.length === 0) candidates = _avisoReenvioUnusedPool
  const chosen = candidates[0]
  _avisoReenvioUnusedPool = _avisoReenvioUnusedPool.filter(i => i !== chosen)
  _avisoReenvioRecentUsed.push(chosen)
  if (_avisoReenvioRecentUsed.length > AVISO_REENVIO_TOTAL) _avisoReenvioRecentUsed.shift()
  return chosen
}

export function buildAvisoReenvioLive(nome: string | null, link: string): string {
  const idx = selectReenvioIndex()
  const nC  = AVISO_REENVIO_CHAMADAS.length
  const nF  = AVISO_FECHAMENTOS.length
  const a   = Math.floor(idx / (nC * nF))
  const c   = Math.floor((idx % (nC * nF)) / nF)
  const f   = idx % nF
  const nomeValido = validateCustomerName(nome)
  return `${renderNamedTemplate(AVISO_ABERTURAS[a], nomeValido)}\n\n${AVISO_REENVIO_CHAMADAS[c]}\n\n${AVISO_FECHAMENTOS[f].replace("{link}", link)}`
}

// ─── Idempotência ─────────────────────────────────────────────────

export function generateNotificationId(liveId: number, compraId: number): string {
  return `live_${liveId}_compra_${compraId}_aviso_live`
}
