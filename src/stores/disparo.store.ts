"use client"

// ══════════════════════════════════════════════════════════════════
// disparo.store — orquestra em BACKGROUND os envios longos do módulo
// Live (disparo de mensagens de compra e aviso de live), com intervalo
// seguro de 80–150s entre cada envio. Substitui as antigas telas cheias
// que prendiam o operador: o loop vive aqui (singleton de módulo), então
// continua rodando ao navegar entre páginas. Um widget flutuante lê este
// estado e mostra o progresso.
//
// Limitação conhecida: como os envios são orquestrados no navegador
// (contorna o teto de 60s da Vercel), o job sobrevive à troca de página
// mas NÃO a fechar a aba / dar refresh — igual às telas cheias antigas.
// ══════════════════════════════════════════════════════════════════

import { create } from "zustand"
import { apiGet, apiPost } from "@/services/api"
import { gerarIntervaloAleatorio } from "@/lib/intervalo-aleatorio"

// Mesmo intervalo usado antes nas telas cheias (anti-bloqueio do WhatsApp)
const LIVE_SAFE_INTERVAL = { minMs: 80_000, maxMs: 150_000, deltaMinMs: 12_000 }

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
  liveId?: number        // ausente em jobs que não são de uma live (ex: consentimento)
  liveTitulo: string     // subtítulo exibido no widget
  total: number
  atual: number          // itens já processados
  nomeAtual: string
  aguardando: number     // segundos até o próximo envio
  status: JobStatus
  enviadas: number
  erros: number
  resultados: JobItemResult[]
  erroFatal?: string     // falha que abortou o job (ex: fila não carregou)
  startedAt: number
}

interface DisparoState {
  job: DisparoJob | null
  minimized: boolean
  /** Inicia o disparo das mensagens de compra. Retorna false se já há job rodando. */
  iniciarDisparo: (p: { liveId: number; liveTitulo: string }) => boolean
  /** Inicia o aviso de live (1º envio ou reenvio). Retorna false se já há job rodando. */
  iniciarAviso: (p: { liveId: number; liveTitulo: string; link: string }) => boolean
  /** Inicia o disparo de consentimento (LGPD) para clientes ainda não notificados. Retorna false se já há job rodando. */
  iniciarConsentimento: () => boolean
  /** Inicia a sincronização em massa com Google Contatos. Retorna false se já há job rodando. */
  iniciarGoogleSync: (clienteIds: number[]) => boolean
  cancelar: () => void
  dispensar: () => void
  setMinimized: (v: boolean) => void
}

// Estado de controle fora do React (sobrevive a re-render/navegação)
let cancelFlag = false
let wakeLock: WakeLockSentinel | null = null
let wakeLockVisibilityListener: (() => void) | null = null

async function pedirWakeLock() {
  try {
    if (!("wakeLock" in navigator)) return
    wakeLock = await navigator.wakeLock.request("screen")
    // Quando o browser libera o Wake Lock (minimizar, trocar aba, tela escurecer),
    // re-solicita assim que a página volta a ficar visível
    if (!wakeLockVisibilityListener) {
      wakeLockVisibilityListener = async () => {
        if (document.visibilityState === "visible" && wakeLock !== null) {
          try { wakeLock = await navigator.wakeLock.request("screen") } catch { /* sem suporte */ }
        }
      }
      document.addEventListener("visibilitychange", wakeLockVisibilityListener)
    }
  } catch { /* sem suporte ou negado — segue sem */ }
}
function soltarWakeLock() {
  wakeLock?.release().catch(() => {})
  wakeLock = null
  if (wakeLockVisibilityListener) {
    document.removeEventListener("visibilitychange", wakeLockVisibilityListener)
    wakeLockVisibilityListener = null
  }
}

/** Espera `segundos`, atualizando o contador regressivo a cada 1s. Aborta se cancelado. */
async function esperarComContagem(
  segundos: number,
  nome: string,
  set: (patch: Partial<DisparoJob>) => void,
) {
  let restante = segundos
  set({ nomeAtual: nome, aguardando: restante })
  while (restante > 0) {
    if (cancelFlag) return
    await new Promise((r) => setTimeout(r, 1000))
    restante--
    set({ aguardando: restante })
  }
}

export const useDisparoStore = create<DisparoState>()((set, get) => {
  // Atualiza campos do job atual de forma segura
  const patchJob = (patch: Partial<DisparoJob>) => {
    const j = get().job
    if (!j) return
    set({ job: { ...j, ...patch } })
  }

  // Runner genérico: busca a fila e processa 1 a 1 com intervalo seguro
  async function rodar(
    fetchFila: () => Promise<{ itens: Array<{ id: number; nome: string }>; aviso?: string }>,
    enviarItem: (item: { id: number; nome: string }) => Promise<JobItemResult>,
  ) {
    cancelFlag = false
    await pedirWakeLock()
    try {
      let fila: Array<{ id: number; nome: string }> = []
      let avisoVazio: string | undefined
      try {
        const r = await fetchFila()
        fila = r.itens
        avisoVazio = r.aviso
      } catch (e) {
        patchJob({ status: "error", erroFatal: (e as Error).message || "Falha ao carregar a fila." })
        return
      }

      if (fila.length === 0) {
        patchJob({ status: "done", total: 0, erroFatal: avisoVazio })
        return
      }

      patchJob({ total: fila.length, atual: 0 })
      let intervaloAnterior: number | undefined

      for (let i = 0; i < fila.length; i++) {
        if (cancelFlag) { patchJob({ status: "cancelled" }); return }
        const item = fila[i]

        if (i > 0) {
          const intervaloMs = gerarIntervaloAleatorio(intervaloAnterior, LIVE_SAFE_INTERVAL)
          intervaloAnterior = intervaloMs
          await esperarComContagem(Math.ceil(intervaloMs / 1000), item.nome, (p) => patchJob(p))
          if (cancelFlag) { patchJob({ status: "cancelled" }); return }
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
            erros: j.erros + (res.status === "erro" ? 1 : 0),
          },
        })
      }

      patchJob({ status: "done", aguardando: 0, nomeAtual: "" })
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

  return {
    job: null,
    minimized: false,

    iniciarDisparo: ({ liveId, liveTitulo }) => {
      if (get().job?.status === "running") return false
      set({ job: novoJob("disparo", liveTitulo, liveId), minimized: false })
      void rodar(
        async () => {
          const r = await apiGet<{ pendentes: Array<{ id: number; nome: string }> }>(`/live/${liveId}/disparar`)
          return { itens: r.pendentes ?? [] }
        },
        async (item) => {
          const r = await apiPost<{ status: string; detalhe?: string; cliente?: string }>(
            `/live/${liveId}/disparar`, { compra_id: item.id },
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

    iniciarAviso: ({ liveId, liveTitulo, link }) => {
      if (get().job?.status === "running") return false
      set({ job: novoJob("aviso", liveTitulo, liveId), minimized: false })
      void rodar(
        async () => {
          const r = await apiGet<{ clientes: Array<{ id: number; nome: string }>; mensagem?: string }>(`/live/${liveId}/aviso`)
          return { itens: r.clientes ?? [], aviso: r.mensagem }
        },
        async (item) => {
          const r = await apiPost<{ status: string; detalhe?: string }>(
            `/live/${liveId}/aviso`, { link, cliente_id: item.id },
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
      set({ job: novoJob("consentimento", "Clientes sem consentimento"), minimized: false })
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
      const itens = clienteIds.map((id) => ({ id, nome: `Cliente #${id}` }))
      set({ job: novoJob("google-sync", "Google Contatos"), minimized: false })
      void rodar(
        async () => {
          // Busca nomes reais para exibir no widget
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
      )
      return true
    },

    cancelar: () => { cancelFlag = true },
    dispensar: () => { cancelFlag = true; set({ job: null, minimized: false }) },
    setMinimized: (v) => set({ minimized: v }),
  }
})
