"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  Search, X, ShoppingBag, TrendingUp, CheckCircle2, Clock,
  MessageSquare, Link2, Package, ChevronRight,
  Loader2, AlertCircle, Radio,
} from "lucide-react"
import { apiGet } from "@/services/api"
import { fmtBRL, fmtData, cn } from "@/lib/utils"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ClienteInfo {
  id: number
  nome: string
  celular?: string | null
  instagram?: string | null
  apelido?: string | null
  email?: string | null
  saldo_credito?: number | null
}

interface CompraItem {
  id: number
  live_id: number
  cliente_id?: number | null
  nome_cliente: string
  whatsapp?: string | null
  numero_sacola?: string | null
  quantidade_itens?: number | null
  valor_total: number
  desconto?: number | null
  status_compra?: string | null
  pagamento_status?: string | null
  msg_status?: string | null
  link_pagamento?: string | null
  data_compra?: string | null
  observacoes_compra?: string | null
  total_produtos_vinculados?: number | null
}

interface LiveAgrupada {
  live_id: number
  live_titulo: string
  live_data: string | null
  live_status: string | null
  live_plataforma: string | null
  compras: CompraItem[]
}

interface Resumo {
  total_lives: number
  total_sacolas: number
  total_itens: number
  total_valor: number
  total_pago: number
  total_pendente: number
  retiradas: number
  pendentes_retirada: number
}

interface BuscaResult {
  encontrado: boolean
  nome_exibido?: string
  cliente?: ClienteInfo | null
  resumo?: Resumo
  lives?: LiveAgrupada[]
}

// ── Status configs ────────────────────────────────────────────────────────────

const STATUS_COMPRA: Record<string, { label: string; cor: string; bg: string }> = {
  aguardando_vinculo: { label: "Ag. Vínculo",  cor: "#8b5cf6", bg: "rgba(139,92,246,0.12)"  },
  vinculo_parcial:    { label: "Parcial",       cor: "#f97316", bg: "rgba(249,115,22,0.12)"  },
  vinculada:          { label: "Vinculada",     cor: "#10b981", bg: "rgba(16,185,129,0.12)"  },
  finalizada:         { label: "Finalizada",    cor: "#10b981", bg: "rgba(16,185,129,0.15)"  },
  retirada:           { label: "Retirada",      cor: "#639922", bg: "rgba(99,153,34,0.15)"   },
  cadastrada:         { label: "Cadastrada",    cor: "#6b7280", bg: "rgba(107,114,128,0.12)" },
}

const STATUS_LIVE: Record<string, { cor: string }> = {
  aberta:    { cor: "#10b981" },
  disparada: { cor: "#3b82f6" },
  encerrada: { cor: "#6b7280" },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      className={cn("rounded-lg", className)}
      style={{ background: "var(--bg-surface)" }}
    />
  )
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const cfg = STATUS_COMPRA[status ?? "cadastrada"] ?? STATUS_COMPRA.cadastrada
  return (
    <span
      className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.cor }}
    >
      {cfg.label}
    </span>
  )
}

function PagamentoBadge({ status }: { status: string | null | undefined }) {
  if (status === "PAGO") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
        style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
        <CheckCircle2 size={9} /> PAGO
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
      style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
      <Clock size={9} /> EM ABERTO
    </span>
  )
}

// ── Ilustração estado vazio ────────────────────────────────────────────────────

function EmptyIllustration({ msg }: { msg: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-3 py-10 px-4"
    >
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="opacity-30">
        <circle cx="32" cy="32" r="30" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="4 3"/>
        <path d="M22 28c0-5.523 4.477-10 10-10s10 4.477 10 10c0 4.38-2.818 8.116-6.77 9.478" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
        <path d="M32 42v2M32 46v2" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      <p className="text-xs font-black uppercase tracking-widest text-center max-w-xs" style={{ color: "var(--text-muted)" }}>
        {msg}
      </p>
      <p className="text-[10px] text-center max-w-xs" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
        Verifique o nome, WhatsApp ou Instagram.
      </p>
    </motion.div>
  )
}

// ── Linha de compra ───────────────────────────────────────────────────────────

function CompraRow({ c, onAbrirLive }: { c: CompraItem; onAbrirLive?: (liveId: number) => void }) {
  const sacola = c.numero_sacola ? `#${c.numero_sacola}` : "—"
  const valor  = c.valor_total - (c.desconto ?? 0)

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl transition-colors"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      whileHover={{ borderColor: "var(--accent)", transition: { duration: 0.15 } }}
    >
      {/* Sacola */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--bg-surface)" }}>
          <ShoppingBag size={14} style={{ color: "var(--accent)" }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
            {sacola}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {c.quantidade_itens ?? 0} iten{(c.quantidade_itens ?? 0) !== 1 ? "s" : ""}
            {c.total_produtos_vinculados != null && (
              <span> · {c.total_produtos_vinculados} vinculado{c.total_produtos_vinculados !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
      </div>

      {/* Valor */}
      <div className="shrink-0 text-right sm:text-center sm:w-24">
        <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{fmtBRL(valor)}</p>
        {(c.desconto ?? 0) > 0 && (
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            desc. {fmtBRL(c.desconto!)}
          </p>
        )}
      </div>

      {/* Badges status */}
      <div className="flex flex-wrap gap-1.5 shrink-0">
        <PagamentoBadge status={c.pagamento_status} />
        <StatusBadge status={c.status_compra} />
        {c.msg_status === "enviada" && (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
            style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
            <MessageSquare size={9} /> MSG ENVIADA
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ── Bloco de uma live ─────────────────────────────────────────────────────────

function LiveBloco({
  grupo, defaultExpanded, onAbrirLive,
}: {
  grupo: LiveAgrupada
  defaultExpanded?: boolean
  onAbrirLive?: (liveId: number) => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true)
  const cfg = STATUS_LIVE[grupo.live_status ?? "encerrada"] ?? STATUS_LIVE.encerrada
  const totalValor = grupo.compras.reduce((s, c) => s + (c.valor_total ?? 0), 0)
  const pagas      = grupo.compras.filter(c => c.pagamento_status === "PAGO").length
  const retiradas  = grupo.compras.filter(c => c.status_compra === "retirada").length

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {/* Header da live */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: "var(--bg-surface)" }}
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.cor }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-wide truncate" style={{ color: "var(--text-primary)" }}>
            {grupo.live_titulo}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {grupo.live_data ? fmtData(grupo.live_data) : "—"} · {grupo.compras.length} sacola{grupo.compras.length !== 1 ? "s" : ""} · {fmtBRL(totalValor)}
            {pagas > 0 && <> · {pagas} paga{pagas !== 1 ? "s" : ""}</>}
            {retiradas > 0 && <> · {retiradas} retirada{retiradas !== 1 ? "s" : ""}</>}
          </p>
        </div>
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
        </motion.div>
      </button>

      {/* Lista de compras */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="p-3 space-y-2">
              {grupo.compras.map((c, i) => (
                <motion.div key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}>
                  <CompraRow c={c} onAbrirLive={onAbrirLive} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

interface Props {
  liveId: number
  liveTitulo?: string
}

export default function BuscaClienteLive({ liveId, liveTitulo }: Props) {
  const [aberto, setAberto]     = useState(false)
  const [query, setQuery]       = useState("")
  const [escopo, setEscopo]     = useState<"esta_live" | "todas">("esta_live")
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<BuscaResult | null>(null)
  const [erro, setErro]         = useState("")
  const inputRef                = useRef<HTMLInputElement>(null)
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 200)
  }, [aberto])

  const buscar = useCallback(async (q: string, esc: string) => {
    if (q.trim().length < 2) { setResult(null); setErro(""); return }
    setLoading(true); setErro("")
    try {
      const data = await apiGet<BuscaResult>(
        `/live/busca-cliente?q=${encodeURIComponent(q)}&live_id=${liveId}&escopo=${esc}`
      )
      setResult(data)
    } catch {
      setErro("Erro ao buscar. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }, [liveId])

  function handleInput(val: string) {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(val, escopo), 380)
  }

  function handleEscopo(e: "esta_live" | "todas") {
    setEscopo(e)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(query, e), 100)
  }

  function limpar() {
    setQuery(""); setResult(null); setErro("")
    inputRef.current?.focus()
  }

  const mostrarResultados = !!result || loading || !!erro

  return (
    <div>
      {/* ── Botão / trigger ─────────────────────────────────── */}
      {!aberto ? (
        <motion.button
          onClick={() => setAberto(true)}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <Search size={13} />
          Consultar Cliente
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}
        >
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="px-4 pt-4 pb-3 flex items-center gap-3" style={{ borderBottom: mostrarResultados ? "1px solid var(--border)" : "none" }}>
            {/* Campo de busca */}
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: loading ? "var(--accent)" : "var(--text-muted)" }} />
              {loading && (
                <motion.div
                  animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Loader2 size={14} style={{ color: "var(--accent)" }} />
                </motion.div>
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={e => handleInput(e.target.value)}
                placeholder="Nome, WhatsApp, @instagram ou apelido..."
                className="w-full text-sm pl-9 pr-8 py-2.5 rounded-xl outline-none transition-all"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                  caretColor: "var(--accent)",
                }}
                onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
              {query && (
                <button onClick={limpar}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors"
                  style={{ color: "var(--text-muted)" }}>
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Escopo */}
            <div className="flex items-center gap-0.5 p-1 rounded-xl shrink-0"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              {(["esta_live", "todas"] as const).map(e => (
                <button key={e} onClick={() => handleEscopo(e)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all"
                  style={{
                    background: escopo === e ? "var(--accent)" : "transparent",
                    color:      escopo === e ? "#fff"          : "var(--text-muted)",
                  }}>
                  {e === "esta_live" ? "Nesta live" : "Todas"}
                </button>
              ))}
            </div>

            {/* Fechar */}
            <motion.button onClick={() => { setAberto(false); limpar() }}
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-full transition-colors shrink-0"
              style={{ color: "var(--text-muted)", background: "var(--bg-surface)" }}>
              <X size={14} />
            </motion.button>
          </div>

          {/* ── Resultados ─────────────────────────────────────── */}
          <AnimatePresence>
            {mostrarResultados && (
              <motion.div
                key="resultados"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
              >
                {/* Skeleton loading */}
                {loading && !result && (
                  <div className="p-4 space-y-3">
                    {/* Card cliente skeleton */}
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-surface)" }}>
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-2 w-24" />
                      </div>
                    </div>
                    {/* Resumo skeleton */}
                    <div className="grid grid-cols-3 gap-2">
                      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
                    </div>
                    {/* Compras skeleton */}
                    {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
                  </div>
                )}

                {/* Erro */}
                {erro && (
                  <div className="p-4 flex items-center gap-2" style={{ color: "#f87171" }}>
                    <AlertCircle size={14} />
                    <p className="text-xs font-semibold">{erro}</p>
                  </div>
                )}

                {/* Não encontrado */}
                {!loading && result && !result.encontrado && (
                  <EmptyIllustration
                    msg={escopo === "esta_live"
                      ? "Nenhuma compra encontrada nesta live."
                      : "Nenhuma compra encontrada em todas as lives."}
                  />
                )}

                {/* Encontrado */}
                {!loading && result?.encontrado && result.resumo && result.lives && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 space-y-4 max-h-[68vh] overflow-y-auto"
                  >
                    {/* ─ DADOS DA CLIENTE ─ */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      className="flex items-center gap-3 p-3.5 rounded-xl"
                      style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                        style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                        {(result.nome_exibido ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                          {result.nome_exibido}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {result.cliente?.celular && (
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              📱 {result.cliente.celular}
                            </span>
                          )}
                          {result.cliente?.instagram && (
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              @{result.cliente.instagram.replace(/^@/, "")}
                            </span>
                          )}
                          {result.cliente?.apelido && (
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              &ldquo;{result.cliente.apelido}&rdquo;
                            </span>
                          )}
                        </div>
                      </div>
                      {result.cliente?.saldo_credito != null && result.cliente.saldo_credito > 0 && (
                        <div className="shrink-0 text-right">
                          <p className="text-[9px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>Crédito</p>
                          <p className="text-sm font-black" style={{ color: "#10b981" }}>
                            {fmtBRL(result.cliente.saldo_credito)}
                          </p>
                        </div>
                      )}
                    </motion.div>

                    {/* ─ RESUMO GERAL ─ */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                        RESUMO {escopo === "todas" ? "GERAL" : "NESTA LIVE"}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { label: "LIVES",         val: result.resumo.total_lives,     cor: "#6366f1", icon: <Radio size={12}/> },
                          { label: "SACOLAS",        val: result.resumo.total_sacolas,   cor: "#8b5cf6", icon: <ShoppingBag size={12}/> },
                          { label: "ITENS ESPERADOS",val: result.resumo.total_itens,     cor: "#06b6d4", icon: <Package size={12}/> },
                          { label: "TOTAL",          val: fmtBRL(result.resumo.total_valor), cor: "#10b981", icon: <TrendingUp size={12}/> },
                          { label: "PAGO",           val: fmtBRL(result.resumo.total_pago),    cor: "#10b981", icon: <CheckCircle2 size={12}/> },
                          { label: "PENDENTE",       val: fmtBRL(result.resumo.total_pendente), cor: "#f59e0b", icon: <Clock size={12}/> },
                          { label: "RETIRADAS",      val: result.resumo.retiradas,       cor: "#639922", icon: <CheckCircle2 size={12}/> },
                          { label: "AG. RETIRADA",   val: result.resumo.pendentes_retirada, cor: "#f97316", icon: <Link2 size={12}/> },
                        ].map((m, i) => (
                          <motion.div key={m.label}
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + i * 0.04 }}
                            className="rounded-xl p-3 flex flex-col gap-1"
                            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] font-black uppercase tracking-widest leading-tight" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                              <span style={{ color: m.cor }}>{m.icon}</span>
                            </div>
                            <p className="text-base font-black" style={{ color: "var(--text-primary)" }}>{m.val}</p>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    {/* ─ LISTA POR LIVE ─ */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18 }}
                      className="space-y-2"
                    >
                      <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                        SACOLAS POR LIVE
                      </p>
                      {result.lives.map((grupo, i) => (
                        <motion.div key={grupo.live_id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + i * 0.06 }}>
                          <LiveBloco
                            grupo={grupo}
                            defaultExpanded={i === 0 || result.lives!.length === 1}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
