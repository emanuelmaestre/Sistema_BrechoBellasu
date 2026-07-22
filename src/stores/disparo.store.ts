"use client"

// ══════════════════════════════════════════════════════════════════
// disparo.store — orquestra em BACKGROUND os envios longos do módulo
// Live (disparo de mensagens de compra e aviso de live), com intervalo
// seguro de 80–150s entre cada envio. Substitui as antigas telas cheias
// que prendiam o operador: o loop vive aqui (singleton de módulo), então
// continua rodando ao navegar entre páginas. Um widget flutuante lê este
// estado e mostra o progresso.
//
// Persistência: os parâmetros do job são salvos no localStorage antes de
// iniciar. Se a aba fechar ou o tablet desligar durante o envio, ao voltar
// o widget oferece retomar de onde parou (a API retorna só os pendentes).
//
// Limitação conhecida: como os envios são orquestrados no navegador
// (contorna o teto de 60s da Vercel), o job sobrevive à troca de página
// mas NÃO a fechar a aba / dar refresh — por isso a persistência via
// localStorage + retomada automática.
// ══════════════════════════════════════════════════════════════════

import { create } from "zustand"
import { apiGet, apiPost } from "@/services/api"
import { gerarIntervaloAleatorio } from "@/lib/intervalo-aleatorio"

const LIVE_SAFE_INTERVAL = { minMs: 80_000, maxMs: 150_000, deltaMinMs: 12_000 }
const GOOGLE_SYNC_INTERVAL = { minMs: 3_000, maxMs: 6_000, deltaMinMs: 1_000 }
const STORAGE_KEY = "disparo_job_pendente"
const MAX_IDADE_JOB_MS = 24 * 60 * 60 * 1_000 // descarta salvos com mais de 24h

export type JobTipo = "disparo" | "aviso" | "consentimento" | "google-sync"
export type JobStatus = "running" | "done" | "cancelled" | "error"

export interface JobItemResult {
  id: number
  nome: string
  status: "enviada" | "erro"
  detalhe?: string
}

export interface DisparoJob {
  id: string
  tipo: JobTipo
  liveId?: number
  liveTitulo: string
  total: number
  atual: number
  nomeAtual: string
  aguardando: number
  status: JobStatus
  enviadas: number
  erros: number
  resultados: JobItemResult[]
  erroFatal?: string
  startedAt: number
}

// Parâmetros mínimos para retomar cada tipo de job após queda
export type JobSalvo =
  | { tipo: "disparo";      liveId: number; liveTitulo: string; chavePix: string; diasPrazo: number; compraIds?: number[]; savedAt: number }
  | { tipo: "aviso";        liveId: number; liveTitulo: string; link: string; reenvio: boolean;     savedAt: number }
  | { tipo: "consentimento";                                                                          savedAt: number }
  | { tipo: "google-sync";  clienteIds: number[];                                                    savedAt: number }

interface DisparoState {
  job: DisparoJob | null
  minimized: boolean
  /** Job interrompido detectado no localStorage — exibido no widget como prompt de retomada. */
  jobSalvo: JobSalvo | null
  iniciarDisparo: (p: { liveId: number; liveTitulo: string; chavePix: string; diasPrazo?: number; compraIds?: number[] }) => boolean
  iniciarAviso: (p: { liveId: number; liveTitulo: string; link: string; reenvio?: boolean }) => boolean
  iniciarConsentimento: () => boolean
  iniciarGoogleSync: (clienteIds: number[]) => boolean
  /** Retoma o job salvo no localStorage (continua de onde parou). */
  retomar: () => boolean
  /** Descarta o job salvo sem retomar. */
  descartarJobSalvo: () => void
  cancelar: () => void
  dispensar: () => void
  setMinimized: (v: boolean) => void
}

// ─── Estado de controle fora do React ────────────────────────────
let cancelFlag = false
let wakeLock: WakeLockSentinel | null = null
let wakeLockVisibilityListener: (() => void) | null = null

// ─── localStorage ─────────────────────────────────────────────────

function salvarJob(params: JobSalvo): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(params)) } catch { /* sem suporte */ }
}

function limparJobSalvo(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* sem suporte */ }
}

function carregarJobSalvo(): JobSalvo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as JobSalvo
    if (Date.now() - parsed.savedAt > MAX_IDADE_JOB_MS) { limparJobSalvo(); return null }
    return parsed
  } catch { return null }
}

// ─── Wake Lock ────────────────────────────────────────────────────

async function pedirWakeLock() {
  try {
    if (!("wakeLock" in navigator)) return
    wakeLock = await navigator.wakeLock.request("screen")
    if (!wakeLockVisibilityListener) {
      wakeLockVisibilityListener = async () => {
        if (document.visibilityState === "visible" && wakeLock !== null) {
          try { wakeLock = await navigator.wakeLock.request("screen") } catch { }
        }
      }
      document.addEventListener("visibilitychange", wakeLockVisibilityListener)
    }
  } catch { }
}

function soltarWakeLock() {
  wakeLock?.release().catch(() => {})
  wakeLock = null
  if (wakeLockVisibilityListener) {
    document.removeEventListener("visibilitychange", wakeLockVisibilityListener)
    wakeLockVisibilityListener = null
  }
}

// ─── Retry para falhas de rede momentâneas ───────────────────────

async function comRetry<T>(fn: () => Promise<T>, tentativas = 3, delayMs = 3_000): Promise<T> {
  let lastErr: Error = new Error("Falha desconhecida")
  for (let i = 0; i < tentativas; i++) {
    try { return await fn() } catch (e) {
      lastErr = e as Error
      if (i < tentativas - 1) await new Promise(r => setTimeout(r, delayMs))
    }
  }
  throw lastErr
}

// ─── Contagem regressiva usando relógio real ──────────────────────
// Usa Date.now() em vez de 120 setTimeouts de 1s: quando o browser
// throttla timers em background, o tempo real passa e o próximo tick
// recalcula corretamente — a contagem não trava.

async function esperarComContagem(
  segundos: number,
  nome: string,
  set: (patch: Partial<DisparoJob>) => void,
) {
  const endTime = Date.now() + segundos * 1_000
  set({ nomeAtual: nome, aguardando: segundos })
  while (true) {
    if (cancelFlag) return
    const restante = Math.max(0, Math.ceil((endTime - Date.now()) / 1_000))
    set({ aguardando: restante })
    if (restante <= 0) break
    await new Promise(r => setTimeout(r, Math.min(1_000, restante * 1_000)))
  }
}

// ─── Store ────────────────────────────────────────────────────────

export const useDisparoStore = create<DisparoState>()((set, get) => {
  const patchJob = (patch: Partial<DisparoJob>) => {
    const j = get().job
    if (!j) return
    set({ job: { ...j, ...patch } })
  }

  async function rodar(
    fetchFila: () => Promise<{ itens: Array<{ id: number; nome: string }>; aviso?: string }>,
    enviarItem: (item: { id: number; nome: string }) => Promise<JobItemResult>,
    intervalo: { minMs: number; maxMs: number; deltaMinMs: number } = LIVE_SAFE_INTERVAL,
  ) {
    cancelFlag = false
    await pedirWakeLock()
    try {
      let fila: Array<{ id: number; nome: string }> = []
      let avisoVazio: string | undefined
      try {
        const r = await comRetry(fetchFila)
        fila = r.itens
        avisoVazio = r.aviso
      } catch (e) {
        patchJob({ status: "error", erroFatal: (e as Error).message || "Falha ao carregar a fila." })
        limparJobSalvo()
        return
      }

      if (fila.length === 0) {
        patchJob({ status: "done", total: 0, erroFatal: avisoVazio })
        limparJobSalvo()
        return
      }

      patchJob({ total: fila.length, atual: 0 })
      let intervaloAnterior: number | undefined

      for (let i = 0; i < fila.length; i++) {
        if (cancelFlag) { patchJob({ status: "cancelled" }); limparJobSalvo(); return }
        const item = fila[i]

        if (i > 0) {
          const intervaloMs = gerarIntervaloAleatorio(intervaloAnterior, intervalo)
          intervaloAnterior = intervaloMs
          await esperarComContagem(Math.ceil(intervaloMs / 1_000), item.nome, (p) => patchJob(p))
          if (cancelFlag) { patchJob({ status: "cancelled" }); limparJobSalvo(); return }
        }

        patchJob({ nomeAtual: item.nome, aguardando: 0, atual: i + 1 })

        let res: JobItemResult
        try {
          res = await enviarItem(item)
        } catch (e) {
          res = { id: item.id, nome: item.nome, status: "erro", detalhe: (e as Error).message || "Falha de rede" }
        }

        const j = get().job
        if (!j) return
        set({
          job: {
            ...j,
            resultados: [...j.resultados, res],
            enviadas: j.enviadas + (res.status === "enviada" ? 1 : 0),
            erros:    j.erros    + (res.status === "erro"    ? 1 : 0),
          },
        })
      }

      patchJob({ status: "done", aguardando: 0, nomeAtual: "" })
      limparJobSalvo()
    } finally {
      soltarWakeLock()
    }
  }

  function novoJob(tipo: JobTipo, liveTitulo: string, liveId?: number): DisparoJob {
    return {
      id: `${tipo}-${liveId ?? "geral"}-${Date.now()}`,
      tipo, liveId, liveTitulo,
      total: 0, atual: 0, nomeAtual: "", aguardando: 0,
      status: "running", enviadas: 0, erros: 0, resultados: [],
      startedAt: Date.now(),
    }
  }

  const jobSalvoInicial = typeof window !== "undefined" ? carregarJobSalvo() : null

  return {
    job: null,
    minimized: false,
    jobSalvo: jobSalvoInicial,

    iniciarDisparo: ({ liveId, liveTitulo, chavePix, diasPrazo = 2, compraIds }) => {
      if (get().job?.status === "running") return false
      salvarJob({ tipo: "disparo", liveId, liveTitulo, chavePix, diasPrazo, compraIds, savedAt: Date.now() })
      set({ job: novoJob("disparo", liveTitulo, liveId), minimized: false, jobSalvo: null })
      void rodar(
        async () => {
          const r = await apiGet<{ pendentes: Array<{ id: number; nome: string }> }>(`/live/${liveId}/disparar`)
          let itens = r.pendentes ?? []
          if (compraIds && compraIds.length) {
            const sel = new Set(compraIds)
            itens = itens.filter(i => sel.has(i.id))
          }
          return { itens }
        },
        async (item) => {
          const r = await apiPost<{ status: string; detalhe?: string; cliente?: string }>(
            `/live/${liveId}/disparar`, { compra_id: item.id, chave_pix: chavePix, dias_prazo: diasPrazo },
          )
          return {
            id: item.id, nome: r.cliente ?? item.nome,
            status: r.status === "enviada" ? "enviada" : "erro",
            detalhe: r.detalhe,
          }
        },
      )
      return true
    },

    iniciarAviso: ({ liveId, liveTitulo, link, reenvio = false }) => {
      if (get().job?.status === "running") return false
      salvarJob({ tipo: "aviso", liveId, liveTitulo, link, reenvio, savedAt: Date.now() })
      set({ job: novoJob("aviso", liveTitulo, liveId), minimized: false, jobSalvo: null })
      void rodar(
        async () => {
          const r = await apiGet<{ clientes: Array<{ id: number; nome: string }>; mensagem?: string }>(
            `/live/${liveId}/aviso`, { link },
          )
          return { itens: r.clientes ?? [], aviso: r.mensagem }
        },
        async (item) => {
          const r = await apiPost<{ status: string; detalhe?: string }>(
            `/live/${liveId}/aviso`, { link, cliente_id: item.id, reenvio },
          )
          return {
            id: item.id, nome: item.nome,
            status: r.status === "enviado" ? "enviada" : "erro",
            detalhe: r.detalhe,
          }
        },
      )
      return true
    },

    iniciarConsentimento: () => {
      if (get().job?.status === "running") return false
      salvarJob({ tipo: "consentimento", savedAt: Date.now() })
      set({ job: novoJob("consentimento", "Clientes sem consentimento"), minimized: false, jobSalvo: null })
      void rodar(
        async () => {
          const r = await apiGet<{ clientes: Array<{ id: number; nome: string }>; total: number }>("/admin/consentimento-nao-enviado")
          return { itens: r.clientes ?? [], aviso: "Nenhuma cliente pendente — todas já receberam o consentimento." }
        },
        async (item) => {
          const r = await apiPost<{ status: string; detalhe?: string }>(
            "/admin/consentimento-nao-enviado", { cliente_id: item.id },
          )
          return {
            id: item.id, nome: item.nome,
            status: r.status === "enviado" ? "enviada" : "erro",
            detalhe: r.detalhe,
          }
        },
      )
      return true
    },

    iniciarGoogleSync: (clienteIds) => {
      if (get().job?.status === "running") return false
      salvarJob({ tipo: "google-sync", clienteIds, savedAt: Date.now() })
      set({ job: novoJob("google-sync", "Google Contatos"), minimized: false, jobSalvo: null })
      void rodar(
        async () => {
          const r = await apiGet<{ clientes: Array<{ id: number; nome: string }> }>("/admin/google-sync-mass")
          const mapa = Object.fromEntries((r.clientes ?? []).map((c) => [c.id, c.nome]))
          const itensNomeados = clienteIds.map((id) => ({ id, nome: mapa[id] ?? `Cliente #${id}` }))
          return { itens: itensNomeados }
        },
        async (item) => {
          const r = await apiPost<{ ok: boolean; nome: string; nomeMontado?: string; acao?: string; erro?: string }>(
            "/admin/google-sync-mass", { cliente_id: item.id },
          )
          return {
            id: item.id,
            nome: r.nome ?? item.nome,
            status: r.ok ? "enviada" : "erro",
            detalhe: r.erro,
          }
        },
        GOOGLE_SYNC_INTERVAL,
      )
      return true
    },

    retomar: () => {
      const salvo = get().jobSalvo
      if (!salvo) return false
      const store = get()
      if (salvo.tipo === "disparo")      return store.iniciarDisparo({ liveId: salvo.liveId, liveTitulo: salvo.liveTitulo, chavePix: salvo.chavePix, diasPrazo: salvo.diasPrazo, compraIds: salvo.compraIds })
      if (salvo.tipo === "aviso")        return store.iniciarAviso({ liveId: salvo.liveId, liveTitulo: salvo.liveTitulo, link: salvo.link, reenvio: salvo.reenvio })
      if (salvo.tipo === "consentimento") return store.iniciarConsentimento()
      if (salvo.tipo === "google-sync")  return store.iniciarGoogleSync(salvo.clienteIds)
      return false
    },

    descartarJobSalvo: () => { limparJobSalvo(); set({ jobSalvo: null }) },

    cancelar: () => { cancelFlag = true; limparJobSalvo() },
    dispensar: () => { cancelFlag = true; limparJobSalvo(); set({ job: null, minimized: false }) },
    setMinimized: (v) => set({ minimized: v }),
  }
})
