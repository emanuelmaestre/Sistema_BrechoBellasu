// ══════════════════════════════════════════════════════════════════
// Disparo Controlado de WhatsApp
// Gerencia o envio sequencial de mensagens com intervalo aleatório
// imprevisível entre 8s e 40s, sem repetição de padrão.
//
// Módulos de origem suportados:
//   "CLIENTES" → consentimento opt-in
//   "LIVE"     → relação de compras da live
//   "VENDAS"   → recibo de venda presencial
// ══════════════════════════════════════════════════════════════════

import { enviarTexto, type ZAPIResult } from "./zapi"

// ─── Tipos ───────────────────────────────────────────────────────

export type ModuloOrigem = "CLIENTES" | "LIVE" | "VENDAS"

export type TipoMensagem =
  | "consentimento"    // CLIENTES
  | "compras_live"     // LIVE
  | "recibo_venda"     // VENDAS

export interface ClienteDisparo {
  id: number
  nome: string
  telefone: string
  mensagem: string         // mensagem já montada (small talk incluso)
  notificationId?: string  // idempotência opcional
}

export interface ResultadoDisparo {
  clienteId:    number
  nome:         string
  telefone:     string
  modulo:       ModuloOrigem
  tipo:         TipoMensagem
  intervalo_ms: number
  horario:      string      // ISO string do momento exato do envio
  ok:           boolean
  messageId?:   string
  erro?:        string
}

export interface SessaoDisparo {
  modulo:       ModuloOrigem
  tipo:         TipoMensagem
  total:        number
  enviadas:     number
  erros:        number
  inicio:       string
  fim?:         string
  resultados:   ResultadoDisparo[]
}

// ─── Gerador de Intervalo Imprevisível ───────────────────────────

/**
 * Retorna um intervalo em ms entre 8.000 e 40.000 com máxima
 * imprevisibilidade. Algoritmo em 3 camadas:
 *
 * 1. Base aleatória via crypto (quando disponível) ou Math.random
 * 2. Perturbação por ruído gaussiano aproximado (soma de 6 uniformes)
 * 3. Inversão aleatória da zona (evita sequência crescente/decrescente)
 *
 * O valor anterior é passado para garantir delta mínimo de 4s,
 * impedindo repetição imediata do mesmo intervalo.
 */
export function gerarIntervaloAleatorio(anteriorMs?: number): number {
  const MIN = 8_000
  const MAX = 40_000
  const RANGE = MAX - MIN
  const DELTA_MIN = 4_000 // diferença mínima do intervalo anterior

  // Camada 1: aleatoriedade criptográfica quando disponível (Node.js / browser)
  function rand(): number {
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      const buf = new Uint32Array(1)
      globalThis.crypto.getRandomValues(buf)
      return buf[0] / 0xFFFFFFFF
    }
    return Math.random()
  }

  // Camada 2: distribuição gaussiana aproximada (Box-Muller simplificado)
  // Soma 6 valores uniformes → distribuição em sino, mas re-escalada para [0,1]
  function gaussianRand(): number {
    let sum = 0
    for (let i = 0; i < 6; i++) sum += rand()
    // Normaliza de [0,6] para [0,1], depois distorce com raiz para achatar as caudas
    const normalizado = sum / 6
    // Inverte aleatoriamente a curva (50% de chance) para evitar tendência central
    return rand() > 0.5 ? normalizado : 1 - normalizado
  }

  // Camada 3: gera candidato e verifica delta mínimo (até 8 tentativas)
  let candidato: number
  let tentativas = 0
  do {
    // Perturbação extra: escolhe aleatoriamente entre 3 estratégias
    const estrategia = Math.floor(rand() * 3)
    let base: number
    if (estrategia === 0) {
      base = gaussianRand()
    } else if (estrategia === 1) {
      // Duas amostras independentes interpoladas por fator aleatório
      base = rand() * 0.4 + rand() * 0.6
    } else {
      // Raiz quadrada para concentrar levemente nos valores baixos
      base = Math.sqrt(rand())
    }
    candidato = Math.round(MIN + base * RANGE)
    tentativas++
  } while (
    anteriorMs !== undefined &&
    Math.abs(candidato - anteriorMs) < DELTA_MIN &&
    tentativas < 8
  )

  return candidato
}

// ─── Formatadores de Log ─────────────────────────────────────────

function fmtMs(ms: number): string {
  const s = (ms / 1000).toFixed(1)
  return `${s}s`
}

function fmtHorario(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  })
}

const ICONE_MODULO: Record<ModuloOrigem, string> = {
  CLIENTES: "👤",
  LIVE:     "📺",
  VENDAS:   "🏪",
}

const ICONE_TIPO: Record<TipoMensagem, string> = {
  consentimento: "📋",
  compras_live:  "🛍️",
  recibo_venda:  "🧾",
}

function logDisparo(r: ResultadoDisparo, pos: number, total: number): void {
  const status   = r.ok ? "✅" : "❌"
  const modIcone = ICONE_MODULO[r.modulo]
  const tipIcone = ICONE_TIPO[r.tipo]
  const horario  = fmtHorario(r.horario)
  const intervalo = fmtMs(r.intervalo_ms)
  const progresso = `[${pos}/${total}]`

  console.log(
    `${status} ${progresso} ${modIcone} ${r.modulo} · ${tipIcone} ${r.tipo}` +
    ` | ${r.nome} (${r.telefone})` +
    ` | ⏱ aguardou ${intervalo}` +
    ` | 🕐 ${horario}` +
    (r.erro ? ` | ⚠️ ${r.erro}` : "")
  )
}

// ─── Função Principal ────────────────────────────────────────────

/**
 * Dispara mensagens sequencialmente para uma lista de clientes,
 * com intervalo aleatório imprevisível entre cada envio.
 *
 * @param clientes    Lista de clientes com telefone e mensagem já montada
 * @param tipo        Tipo da mensagem (define o log e o contexto)
 * @param modulo      Módulo de origem do disparo
 * @param onProgresso Callback opcional chamado após cada envio
 *
 * @returns SessaoDisparo com resumo completo da sessão
 */
export async function dispararMensagens(
  clientes:     ClienteDisparo[],
  tipo:         TipoMensagem,
  modulo:       ModuloOrigem,
  onProgresso?: (resultado: ResultadoDisparo, sessao: SessaoDisparo) => void,
): Promise<SessaoDisparo> {

  const sessao: SessaoDisparo = {
    modulo,
    tipo,
    total:      clientes.length,
    enviadas:   0,
    erros:      0,
    inicio:     new Date().toISOString(),
    resultados: [],
  }

  if (clientes.length === 0) {
    sessao.fim = new Date().toISOString()
    console.log(`ℹ️  [${modulo}] Nenhum cliente para disparar.`)
    return sessao
  }

  console.log(`\n🚀 Iniciando disparo — ${ICONE_MODULO[modulo]} ${modulo} · ${ICONE_TIPO[tipo]} ${tipo}`)
  console.log(`📊 Total: ${clientes.length} cliente(s) | Intervalo: 8s–40s imprevisível\n`)

  // Mapa de tipo para LogTipo do zapi.ts
  const zapiTipo = tipo === "consentimento" ? "consentimento"
    : tipo === "compras_live"               ? "aviso_live"
    : "recibo_venda" as const

  let intervaloAnterior: number | undefined

  for (let i = 0; i < clientes.length; i++) {
    const cliente = clientes[i]
    const pos     = i + 1

    // Gera intervalo antes de enviar (exceto na primeira mensagem — sem espera)
    let intervaloMs = 0
    if (i > 0) {
      intervaloMs = gerarIntervaloAleatorio(intervaloAnterior)
      intervaloAnterior = intervaloMs
      console.log(`⏳ Aguardando ${fmtMs(intervaloMs)} antes do próximo envio...`)
      await new Promise(res => setTimeout(res, intervaloMs))
    }

    const horario = new Date().toISOString()

    // Envia via Z-API
    let resultado: ZAPIResult
    try {
      resultado = await enviarTexto(cliente.telefone, cliente.mensagem, zapiTipo)
    } catch (e) {
      resultado = { ok: false, erro: e instanceof Error ? e.message : String(e) }
    }

    const entrada: ResultadoDisparo = {
      clienteId:    cliente.id,
      nome:         cliente.nome,
      telefone:     cliente.telefone,
      modulo,
      tipo,
      intervalo_ms: intervaloMs,
      horario,
      ok:           resultado.ok,
      messageId:    resultado.messageId,
      erro:         resultado.erro,
    }

    sessao.resultados.push(entrada)
    if (resultado.ok) sessao.enviadas++
    else              sessao.erros++

    logDisparo(entrada, pos, clientes.length)
    onProgresso?.(entrada, { ...sessao })
  }

  sessao.fim = new Date().toISOString()

  // Resumo final
  const duracao = ((new Date(sessao.fim).getTime() - new Date(sessao.inicio).getTime()) / 1000).toFixed(0)
  console.log(`\n─────────────────────────────────────────────`)
  console.log(`✅ Enviadas: ${sessao.enviadas} | ❌ Erros: ${sessao.erros} | ⏱ Duração: ${duracao}s`)
  console.log(`─────────────────────────────────────────────\n`)

  return sessao
}

// ─── Utilitário: estima duração da sessão ────────────────────────

/**
 * Estima a duração mínima e máxima de uma sessão antes de executá-la.
 * Útil para informar o operador quanto tempo o disparo vai levar.
 */
export function estimarDuracao(quantidadeClientes: number): { minutos_min: number; minutos_max: number } {
  if (quantidadeClientes <= 1) return { minutos_min: 0, minutos_max: 0 }
  const intervalos = quantidadeClientes - 1
  const min_ms = intervalos * 8_000
  const max_ms = intervalos * 40_000
  return {
    minutos_min: Math.ceil(min_ms / 60_000),
    minutos_max: Math.ceil(max_ms / 60_000),
  }
}
