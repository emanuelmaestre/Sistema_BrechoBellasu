"use client"

import { useState, useRef, useCallback } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  Search, X, ShoppingBag, TrendingUp, CheckCircle2, Clock,
  MessageSquare, Link2, Package, ChevronRight, ChevronDown,
  Loader2, AlertCircle, Radio, ExternalLink,
} from "lucide-react"
import { apiGet } from "@/services/api"
import { fmtBRL, fmtData, cn } from "@/lib/utils"

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface ClienteInfo {
  id: number
  nome: string
  celular?: string | null
  instagram?: string | null
  apelido?: string | null
  saldo_credito?: number | null
}

interface CompraItem {
  id: number
  live_id: number
  nome_cliente: string
  whatsapp?: string | null
  cor_sacola?: string | null
  numero_sacola?: string | null
  quantidade_itens?: number | null
  valor_total: number
  desconto?: number | null
  status_compra?: string | null
  pagamento_status?: string | null
  msg_status?: string | null
  total_produtos_vinculados?: number | null
  data_compra?: string | null
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

// ── Status ────────────────────────────────────────────────────────────────────

const SC: Record<string, { label: string; cor: string; bg: string }> = {
  aguardando_vinculo: { label: "Ag. Vínculo",  cor: "#8b5cf6", bg: "rgba(139,92,246,0.12)"  },
  vinculo_parcial:    { label: "Vínc. Parcial", cor: "#f97316", bg: "rgba(249,115,22,0.12)"  },
  vinculada:          { label: "Vinculada",      cor: "#10b981", bg: "rgba(16,185,129,0.12)"  },
  finalizada:         { label: "Não Retirado",   cor: "#f97316", bg: "rgba(249,115,22,0.15)"  },
  retirada:           { label: "Retirado",       cor: "#10b981", bg: "rgba(16,185,129,0.2)"   },
  cadastrada:         { label: "Cadastrada",     cor: "#6b7280", bg: "rgba(107,114,128,0.12)" },
}

const SL: Record<string, string> = {
  aberta: "#10b981", disparada: "#3b82f6", encerrada: "#6b7280",
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{ opacity: [0.35, 0.65, 0.35] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className={cn("rounded-lg", className)}
      style={{ background: "var(--bg-surface)" }}
    />
  )
}

function Badge({ status }: { status: string | null | undefined }) {
  const cfg = SC[status ?? "cadastrada"] ?? SC.cadastrada
  return (
    <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.cor }}>
      {cfg.label}
    </span>
  )
}

function PagBadge({ status }: { status: string | null | undefined }) {
  return status === "PAGO" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
      style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
      <CheckCircle2 size={9}/> PAGO
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
      style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
      <Clock size={9}/> EM ABERTO
    </span>
  )
}

// ── LiveBloco ─────────────────────────────────────────────────────────────────

function LiveBloco({
  grupo, defaultExpanded, onAbrirLive,
}: {
  grupo: LiveAgrupada
  defaultExpanded?: boolean
  onAbrirLive: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true)
  const cor    = SL[grupo.live_status ?? "encerrada"] ?? SL.encerrada
  const total  = grupo.compras.reduce((s, c) => s + (c.valor_total ?? 0), 0)
  const pagas  = grupo.compras.filter(c => c.pagamento_status === "PAGO").length
  const ret    = grupo.compras.filter(c => c.status_compra === "retirada").length

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {/* Header da live */}
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: "var(--bg-surface)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-surface)")}>

        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }}/>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-wide truncate" style={{ color: "var(--text-primary)" }}>
            {grupo.live_titulo}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {grupo.live_data ? fmtData(grupo.live_data) : "—"}
            {" · "}{grupo.compras.length} sacola{grupo.compras.length !== 1 ? "s" : ""}
            {" · "}{fmtBRL(total)}
            {pagas > 0 && <> · {pagas} paga{pagas !== 1 ? "s" : ""}</>}
            {ret > 0 && <> · {ret} retirada{ret !== 1 ? "s" : ""}</>}
          </p>
        </div>

        <motion.button
          onClick={e => { e.stopPropagation(); onAbrirLive(grupo.live_id) }}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg shrink-0"
          style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
          <ExternalLink size={10}/> Abrir Live
        </motion.button>

        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight size={14} style={{ color: "var(--text-muted)" }}/>
        </motion.div>
      </button>

      {/* Compras */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}>

            {/* Header tabela — só desktop */}
            <div className="hidden sm:grid px-4 py-2"
              style={{ gridTemplateColumns: "1.5fr 1fr 70px 90px 96px 96px 112px", borderBottom: "1px solid var(--border)", background: "var(--bg-base)" }}>
              {["CLIENTE","SACOLA","ITENS","VALOR","PAGAMENTO","STATUS","RETIRADA"].map(h => (
                <p key={h} className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{h}</p>
              ))}
            </div>

            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {grupo.compras.map((c, i) => {
                const sacola = [c.cor_sacola, c.numero_sacola ? `#${c.numero_sacola}` : ""].filter(Boolean).join(" ") || "—"
                const valor  = (c.valor_total ?? 0) - (c.desconto ?? 0)
                return (
                  <motion.div key={c.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.035 }}
                    className="px-4 py-3 transition-colors"
                    style={{ borderColor: "var(--border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

                    {/* Desktop: grid */}
                    <div className="hidden sm:grid items-center gap-2"
                      style={{ gridTemplateColumns: "1.5fr 1fr 70px 90px 96px 96px 112px" }}>
                      {/* Nome da cliente */}
                      <p className="text-xs font-black uppercase truncate" style={{ color: "var(--text-primary)" }}>
                        {c.nome_cliente}
                      </p>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "var(--bg-surface)" }}>
                          <ShoppingBag size={12} style={{ color: "var(--accent)" }}/>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase truncate" style={{ color: "var(--text-primary)" }}>{sacola}</p>
                          {c.msg_status === "enviada" && (
                            <span className="text-[9px]" style={{ color: "#60a5fa" }}>
                              <MessageSquare size={8} className="inline mr-0.5"/>msg enviada
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                        {c.total_produtos_vinculados ?? 0}/{c.quantidade_itens ?? 0}
                      </p>
                      <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{fmtBRL(valor)}</p>
                      <PagBadge status={c.pagamento_status}/>
                      <Badge status={c.status_compra}/>
                      <div className="flex items-center">
                        {c.status_compra === "retirada" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                            <CheckCircle2 size={9}/> RETIRADO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: "rgba(107,114,128,0.1)", color: "var(--text-muted)" }}>
                            <Clock size={9}/> NÃO RETIRADO
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mobile: stack */}
                    <div className="sm:hidden flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "var(--bg-surface)" }}>
                        <ShoppingBag size={14} style={{ color: "var(--accent)" }}/>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs font-black uppercase" style={{ color: "var(--text-primary)" }}>{c.nome_cliente}</p>
                        <p className="text-xs font-black uppercase" style={{ color: "var(--text-primary)" }}>{sacola}</p>
                        <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{fmtBRL(valor)}</p>
                        <div className="flex flex-wrap gap-1">
                          <PagBadge status={c.pagamento_status}/>
                          <Badge status={c.status_compra}/>
                          {c.status_compra === "retirada" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                              <CheckCircle2 size={9}/> RETIRADO
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(107,114,128,0.1)", color: "var(--text-muted)" }}>
                              <Clock size={9}/> NÃO RETIRADO
                            </span>
                          )}
                        </div>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {c.total_produtos_vinculados ?? 0}/{c.quantidade_itens ?? 0} itens vinculados
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function BuscaClienteGlobal({ onAbrirLive }: { onAbrirLive: (id: number) => void }) {
  const [query, setQuery]     = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<BuscaResult | null>(null)
  const [erro, setErro]       = useState("")
  const debounce              = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef              = useRef<HTMLInputElement>(null)

  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResult(null); setErro(""); return }
    setLoading(true); setErro("")
    try {
      const data = await apiGet<BuscaResult>(
        `/live/busca-cliente?q=${encodeURIComponent(q)}&escopo=todas`
      )
      setResult(data)
    } catch {
      setErro("Não foi possível realizar a busca. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(v: string) {
    setQuery(v)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => buscar(v), 380)
  }

  function limpar() {
    setQuery(""); setResult(null); setErro("")
    inputRef.current?.focus()
  }

  const temResultado = result?.encontrado && result.resumo && result.lives
  const semResultado = result && !result.encontrado && !loading
  const mostrarPainel = loading || temResultado || semResultado || !!erro

  return (
    <div className="space-y-0">
      {/* ── Barra de pesquisa ──────────────────────────────── */}
      <div className="relative">
        {/* Ícone / spinner */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="spin" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>
                <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }}/>
              </motion.div>
            ) : (
              <motion.div key="icon" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>
                <Search size={16} style={{ color: query ? "var(--accent)" : "var(--text-muted)" }}/>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input
          ref={inputRef}
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder="Nome, WhatsApp, Instagram, apelido ou nº da sacola…"
          className="w-full pl-11 pr-10 py-3.5 text-sm rounded-2xl outline-none transition-all"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            border: `1px solid ${query ? "var(--accent)" : "var(--border)"}`,
            boxShadow: query ? "0 0 0 3px var(--accent-bg)" : "none",
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-bg)" }}
          onBlur={e => { if (!query) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" } }}
        />

        <AnimatePresence>
          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
              onClick={limpar} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors"
              style={{ color: "var(--text-muted)", background: "var(--bg-surface)" }}>
              <X size={13}/>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Painel de resultados ─────────────────────────── */}
      <AnimatePresence>
        {mostrarPainel && (
          <motion.div
            key="painel"
            initial={{ opacity: 0, y: -8, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.97 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="rounded-2xl overflow-hidden mt-3"
            style={{ transformOrigin: "top", border: "1px solid var(--border)", background: "var(--bg-card)" }}
          >
            {/* Skeleton */}
            {loading && !result && (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0"/>
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-48"/>
                    <Skeleton className="h-2 w-32"/>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl"/>)}
                </div>
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl"/>)}
                </div>
              </div>
            )}

            {/* Erro */}
            {erro && !loading && (
              <div className="p-5 flex items-center gap-2.5" style={{ color: "#f87171" }}>
                <AlertCircle size={16}/>
                <p className="text-sm font-semibold">{erro}</p>
              </div>
            )}

            {/* Não encontrado */}
            {semResultado && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="py-14 flex flex-col items-center gap-3 px-6">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="opacity-20">
                  <circle cx="28" cy="28" r="18" stroke="var(--text-muted)" strokeWidth="2.5"/>
                  <path d="M40 40L52 52" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M22 28h12M28 22v12" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
                </svg>
                <p className="text-sm font-black uppercase tracking-widest text-center" style={{ color: "var(--text-muted)" }}>
                  Nenhuma compra encontrada
                </p>
                <p className="text-xs text-center max-w-xs" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                  Verifique se o nome, WhatsApp ou Instagram foram digitados corretamente.
                </p>
                <button onClick={limpar}
                  className="text-xs font-bold px-4 py-2 rounded-xl mt-1 transition-colors"
                  style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  Limpar busca
                </button>
              </motion.div>
            )}

            {/* Encontrado */}
            {!loading && temResultado && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
                className="p-5 space-y-3">

                {/* ─ SACOLAS POR LIVE ─ */}
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    SACOLAS POR LIVE ({result!.lives!.length} live{result!.lives!.length !== 1 ? "s" : ""})
                  </p>
                  <motion.button onClick={limpar}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
                    style={{ background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    <X size={12}/> Limpar
                  </motion.button>
                </div>

                <div className="space-y-2">
                  {result!.lives!.map((grupo, i) => (
                    <motion.div key={grupo.live_id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}>
                      <LiveBloco
                        grupo={grupo}
                        defaultExpanded={i === 0 || result!.lives!.length === 1}
                        onAbrirLive={onAbrirLive}
                      />
                    </motion.div>
                  ))}
                </div>

              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Estado inicial — dica sutil */}
      <AnimatePresence>
        {!query && !mostrarPainel && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-[11px] text-center pt-1"
            style={{ color: "var(--text-muted)", opacity: 0.5 }}>
            Digite nome, WhatsApp, Instagram ou apelido da cliente para consultar as sacolas
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
