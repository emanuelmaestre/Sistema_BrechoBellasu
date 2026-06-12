"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "motion/react"
import { RefreshCw, Loader2, CheckCircle2, XCircle, Clock, AlertCircle, Play, RotateCcw } from "lucide-react"
import { apiGet, apiPost } from "@/services/api"
import { cn } from "@/lib/utils"

type PreviewCliente = {
  id: number
  nome: string
  nomeMontado: string
  telefone: string | null
  telValido: boolean
  telErro?: string | null
  temId: boolean
  status: string | null
  acao: "criar" | "atualizar" | "ignorar"
}

type PreviewResp = {
  totais: {
    total: number
    criarNovos: number
    atualizar: number
    semTelefone: number
    telInvalido: number
    ignorados: number
  }
  clientes: PreviewCliente[]
}

type SyncResult = {
  id: number
  ok: boolean
  nome: string
  nomeMontado?: string
  acao?: string
  erro?: string
}

const ACAO_COR: Record<string, string> = {
  criar:     "text-emerald-400",
  atualizar: "text-blue-400",
  ignorar:   "text-slate-500",
}

const STATUS_ICON = {
  pendente:      <Clock      size={13} className="text-slate-400" />,
  sincronizando: <Loader2    size={13} className="animate-spin text-blue-400" />,
  sincronizado:  <CheckCircle2 size={13} className="text-emerald-400" />,
  erro:          <XCircle    size={13} className="text-red-400" />,
}

export default function GoogleSyncPage() {
  const [running, setRunning]       = useState(false)
  const [resultados, setResultados] = useState<SyncResult[]>([])
  const [progresso, setProgresso]   = useState(0)
  const [total, setTotal]           = useState(0)
  const [concluido, setConcluido]   = useState(false)
  const [filtro, setFiltro]         = useState<"todos" | "criar" | "atualizar" | "ignorar">("todos")

  const { data, isLoading, refetch } = useQuery<PreviewResp>({
    queryKey: ["google-sync-preview"],
    queryFn: () => apiGet("/admin/google-sync-mass"),
    staleTime: 30_000,
  })

  const clientes = (data?.clientes ?? []).filter(c =>
    filtro === "todos" ? true : c.acao === filtro
  )
  const paraExecutar = (data?.clientes ?? []).filter(c => c.acao !== "ignorar")

  async function iniciarSync() {
    if (!paraExecutar.length) return
    setRunning(true); setConcluido(false)
    setResultados([]); setProgresso(0)
    setTotal(paraExecutar.length)

    for (let i = 0; i < paraExecutar.length; i++) {
      const c = paraExecutar[i]
      try {
        const r = await apiPost("/admin/google-sync-mass", { cliente_id: c.id }) as {
          ok: boolean; nome: string; nomeMontado?: string; acao?: string; erro?: string
        }
        setResultados(prev => [...prev, { id: c.id, ok: r.ok, nome: r.nome, nomeMontado: r.nomeMontado, acao: r.acao, erro: r.erro }])
      } catch (e) {
        setResultados(prev => [...prev, { id: c.id, ok: false, nome: c.nome, erro: (e as Error).message }])
      }
      setProgresso(i + 1)
    }

    setRunning(false); setConcluido(true)
    refetch()
  }

  const okCount    = resultados.filter(r => r.ok).length
  const erroCount  = resultados.filter(r => !r.ok).length
  const pct        = total > 0 ? Math.round((progresso / total) * 100) : 0

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(66,133,244,0.12)", border: "1px solid rgba(66,133,244,0.25)" }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Sincronização Google Contatos</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Sincronize todos os clientes ativos com a agenda Google</p>
        </div>
      </div>

      {/* Totais */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} /></div>
      ) : data && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Criar novos",  value: data.totais.criarNovos, color: "#10b981" },
              { label: "Atualizar",    value: data.totais.atualizar,  color: "#60a5fa" },
              { label: "Ignorar",      value: data.totais.ignorados,  color: "#64748b" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {data.totais.telInvalido > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4 text-xs"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
              <AlertCircle size={14} className="shrink-0" />
              {data.totais.telInvalido} cliente(s) com telefone inválido — serão ignorados.
            </div>
          )}

          {/* Barra de progresso */}
          {(running || concluido) && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-4 mb-4 space-y-3"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--text-muted)" }}>
                  {running ? `Sincronizando ${progresso}/${total}…` : `Concluído — ${okCount} ok, ${erroCount} erro(s)`}
                </span>
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>{pct}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-card)" }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: running ? "var(--accent)" : erroCount > 0 ? "#f59e0b" : "#10b981" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.3 }} />
              </div>

              {/* Resultados em tempo real */}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                <AnimatePresence>
                  {resultados.map(r => (
                    <motion.div key={r.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 text-xs py-1"
                      style={{ borderBottom: "1px solid var(--border)" }}>
                      {r.ok
                        ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                        : <XCircle      size={12} className="text-red-400 shrink-0" />}
                      <span className="flex-1 truncate" style={{ color: r.ok ? "var(--text-primary)" : "#f87171" }}>
                        {r.nome}
                        {r.nomeMontado && r.nomeMontado !== r.nome && ` → ${r.nomeMontado}`}
                      </span>
                      {r.erro && <span className="text-[10px] text-red-400 shrink-0 truncate max-w-[140px]">{r.erro}</span>}
                      {r.ok && r.acao && (
                        <span className={cn("text-[10px] font-semibold uppercase shrink-0", ACAO_COR[r.acao])}>{r.acao}</span>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* Botão de ação */}
          {!running && (
            <button onClick={concluido ? () => { setConcluido(false); setResultados([]); refetch() } : iniciarSync}
              disabled={!concluido && paraExecutar.length === 0}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all mb-5 disabled:opacity-40"
              style={{
                background: concluido ? "rgba(100,116,139,0.12)" : "var(--accent)",
                color: concluido ? "var(--text-muted)" : "#fff",
                border: concluido ? "1px solid var(--border)" : "none",
              }}>
              {concluido
                ? <><RotateCcw size={14} /> Recarregar prévia</>
                : <><Play size={14} /> Sincronizar {paraExecutar.length} clientes</>}
            </button>
          )}

          {/* Filtros + lista prévia */}
          <div className="flex gap-1 mb-3 flex-wrap">
            {(["todos", "criar", "atualizar", "ignorar"] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize"
                style={{
                  background: filtro === f ? "var(--accent)" : "var(--bg-surface)",
                  color:      filtro === f ? "#fff" : "var(--text-muted)",
                  border:     "1px solid var(--border)",
                }}>
                {f} {f !== "todos" && `(${(data.clientes ?? []).filter(c => c.acao === f).length})`}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            {clientes.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                {c.status ? (STATUS_ICON[c.status as keyof typeof STATUS_ICON] ?? <Clock size={13} className="text-slate-400" />) : <Clock size={13} className="text-slate-400" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.nomeMontado}</p>
                  {c.telefone && (
                    <p className="text-[10px]" style={{ color: c.telValido ? "var(--text-muted)" : "#f87171" }}>
                      {c.telefone}{!c.telValido && c.telErro ? ` — ${c.telErro}` : ""}
                    </p>
                  )}
                  {!c.telefone && (
                    <p className="text-[10px]" style={{ color: "#94a3b8" }}>sem telefone</p>
                  )}
                </div>
                <span className={cn("text-[10px] font-bold uppercase shrink-0", ACAO_COR[c.acao])}>{c.acao}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
