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

import { enviarTexto, enviarDocumento, type ZAPIResult } from "./zapi"
import { gerarIntervaloAleatorio } from "./intervalo-aleatorio"

// Re-exporta para manter compatibilidade com imports existentes.
export { gerarIntervaloAleatorio }

// ─── Log estruturado único (usado por todos os módulos) ──────────

export interface LogEnvio {
  modulo:       ModuloOrigem
  tipo:         TipoMensagem
  clienteId?:   number
  nome:         string
  telefone:     string
  horario:      string
  intervalo_ms: number
  ok:           boolean
  messageId?:   string
  erro?:        string
}

function emitirLog(log: LogEnvio, pos?: number, total?: number): void {
  const status   = log.ok ? "✅" : "❌"
  const progresso = pos != null && total != null ? `[${pos}/${total}] ` : ""
  const intervaloStr = log.intervalo_ms > 0 ? ` | ⏱ aguardou ${(log.intervalo_ms/1000).toFixed(1)}s` : ""
  const horario  = new Date(log.horario).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const iconeModulo: Record<ModuloOrigem, string> = { CLIENTES: "👤", LIVE: "📺", VENDAS: "🏪" }
  const iconeTipo:   Record<TipoMensagem, string> = { consentimento: "📋", compras_live: "🛍️", recibo_venda: "🧾" }

  console.log(
    `${status} ${progresso}${iconeModulo[log.modulo]} ${log.modulo} · ` +
    `${iconeTipo[log.tipo]} ${log.tipo} | ${log.nome} (${log.telefone})` +
    `${intervaloStr} | 🕐 ${horario}` +
    (log.erro ? ` | ⚠️ ${log.erro}` : "")
  )
}

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

// ─── Envio único com log estruturado (CLIENTES / VENDAS) ─────────

/** Envia uma única mensagem de texto com log estruturado */
export async function dispararTextoUnico(params: {
  clienteId?: number
  nome:       string
  telefone:   string
  mensagem:   string
  tipo:       TipoMensagem
  modulo:     ModuloOrigem
}): Promise<ZAPIResult> {
  const zapiTipo = params.tipo === "consentimento" ? "consentimento"
    : params.tipo === "compras_live"               ? "aviso_live"
    : "recibo_venda" as const

  const horario = new Date().toISOString()
  const resultado = await enviarTexto(params.telefone, params.mensagem, zapiTipo)

  emitirLog({
    modulo:       params.modulo,
    tipo:         params.tipo,
    clienteId:    params.clienteId,
    nome:         params.nome,
    telefone:     params.telefone,
    horario,
    intervalo_ms: 0,
    ok:           resultado.ok,
    messageId:    resultado.messageId,
    erro:         resultado.erro,
  })

  return resultado
}

/** Envia um único documento (PDF) com log estruturado */
export async function dispararDocumentoUnico(params: {
  clienteId?: number
  nome:       string
  telefone:   string
  docUrl:     string
  docNome:    string
  caption:    string
  tipo:       TipoMensagem
  modulo:     ModuloOrigem
}): Promise<ZAPIResult> {
  const horario = new Date().toISOString()
  const resultado = await enviarDocumento(params.telefone, params.docUrl, params.docNome, params.caption, "recibo_venda")

  emitirLog({
    modulo:       params.modulo,
    tipo:         params.tipo,
    clienteId:    params.clienteId,
    nome:         params.nome,
    telefone:     params.telefone,
    horario,
    intervalo_ms: 0,
    ok:           resultado.ok,
    messageId:    resultado.messageId,
    erro:         resultado.erro,
  })

  return resultado
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
