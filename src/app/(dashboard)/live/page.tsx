"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import {
  Plus, Loader2, X, ChevronLeft, ArrowRight, Radio, Send,
  Check, Search, ShoppingBag, User, ChevronDown, Package,
  AlertTriangle, CheckCircle2, Link2, Trash2, ChevronRight,
  Zap, Clock, Circle, Ban, RefreshCw, TrendingUp, Users,
  MessageSquare, PackageCheck, Lock, Pencil, Save,
} from "lucide-react"
import { apiGet, apiPost, apiPatch, apiDelete } from "@/services/api"
import { useDropdownKeyNav } from "@/hooks/useKeyNav"
import DatePicker from "@/components/DatePicker"
import { fmtBRL, fmtData, cn } from "@/lib/utils"
import type { Live } from "@/types"

// ─── Tipos ────────────────────────────────────────────────
export interface Compra {
  id: number
  nome_cliente: string
  whatsapp?: string
  numero_sacola?: string
  cor_sacola?: string
  quantidade_itens?: number
  quantidade_volumes?: number
  valor_total: number
  desconto?: number
  msg_status?: string
  data_compra?: string
  link_pagamento?: string
  pagamento_status?: string
  status_compra?: string
  observacao?: string
  total_produtos_vinculados?: number
  total_estoque_baixado?: number
}

type LiveDetalhe = Live & { compras: Compra[] }

interface Cliente {
  id: number; nome: string; cpf_cnpj?: string | null; celular?: string | null
}

interface ProdutoVinculo {
  id: number
  compra_id: number
  produto_id?: number
  nome_produto: string
  quantidade: number
  preco_original: number
  preco_live: number
  desconto_aplicado?: number
  estoque_baixado: boolean
}

interface LiveForm { data_live: string; titulo: string; plataforma: string; tipo: "novidades" | "promocional"; link_live: string }
interface CompraForm {
  cliente_id: number | null; nome_cliente: string; whatsapp: string
  cor_sacola: string; numero_sacola: string
  quantidade_itens: string
  valor_total: string; desconto: string; observacao: string
  link_pagamento: string
}

const hoje = new Date().toISOString().split("T")[0]
const EMPTY_LIVE: LiveForm = { data_live: hoje, titulo: "", plataforma: "instagram", tipo: "novidades", link_live: "" }
const EMPTY_COMPRA: CompraForm = {
  cliente_id: null, nome_cliente: "", whatsapp: "",
  cor_sacola: "", numero_sacola: "",
  quantidade_itens: "1",
  valor_total: "", desconto: "", observacao: "",
  link_pagamento: "",
}

const CORES_SACOLA = ["Amarela","Azul","Bege","Branca","Cinza","Laranja","Lilás","Marrom","Preta","Rosa","Roxa","Verde","Vermelha"]
const COR_LIVE = "#e11d48"

// ─── Status colors (lista) ────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  aberta:    "bg-emerald-500/10 text-emerald-400",
  encerrada: "bg-slate-500/15 text-slate-400",
  disparada: "bg-blue-500/10 text-blue-400",
}

// ─── Status configs ────────────────────────────────────────
const STATUS_LIVE: Record<string, { label: string; cor: string; bg: string }> = {
  aberta:      { label: "Aberta",       cor: "#10b981", bg: "rgba(16,185,129,0.12)" },
  disparada:   { label: "Msgs enviadas",cor: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  encerrada:   { label: "Encerrada",    cor: "#6b7280", bg: "rgba(107,114,128,0.12)" },
}
const STATUS_COMPRA: Record<string, { label: string; cor: string; bg: string; icon: React.ReactNode }> = {
  cadastrada:       { label: "Cadastrada",           cor: "#6b7280", bg: "rgba(107,114,128,0.1)",  icon: <Circle size={11}/> },
  msg_pendente:     { label: "Msg pendente",         cor: "#f59e0b", bg: "rgba(245,158,11,0.1)",   icon: <Clock size={11}/> },
  msg_enviada:      { label: "Msg enviada",          cor: "#3b82f6", bg: "rgba(59,130,246,0.1)",   icon: <MessageSquare size={11}/> },
  aguardando_vinculo: { label: "Aguardando vínculo", cor: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  icon: <Link2 size={11}/> },
  vinculo_parcial:  { label: "Vínculo parcial",      cor: "#f97316", bg: "rgba(249,115,22,0.1)",   icon: <Package size={11}/> },
  vinculada:        { label: "Produtos vinculados",  cor: "#10b981", bg: "rgba(16,185,129,0.1)",   icon: <PackageCheck size={11}/> },
  finalizada:       { label: "Finalizada",           cor: "#10b981", bg: "rgba(16,185,129,0.15)",  icon: <CheckCircle2 size={11}/> },
}

// ─── Progresso da live ────────────────────────────────────
const ETAPAS_LIVE = [
  { id: 1, label: "Criada" },
  { id: 2, label: "Compras" },
  { id: 3, label: "Mensagens" },
  { id: 4, label: "Produtos" },
  { id: 5, label: "Estoque" },
  { id: 6, label: "Encerrada" },
]

function calcEtapa(live: LiveDetalhe): number {
  // Etapas visuais: 1=CRIADA 2=COMPRAS 3=MENSAGENS 4=PRODUTOS 5=ESTOQUE 6=ENCERRADA
  if (live.status === "encerrada") return 6
  const compras = live.compras ?? []
  if (!compras.length) return 2                                                          // sem compras → ir para COMPRAS
  const disparada = live.status === "disparada" || compras.some(c => c.msg_status === "enviada")
  if (!disparada) return 3                                                               // compras ok → ir para MENSAGENS
  const todasVinculadas = compras.every(c => c.status_compra === "vinculada" || c.status_compra === "finalizada")
  if (!todasVinculadas) return 4                                                         // msgs ok → ir para PRODUTOS
  const todasFinalizadas = compras.every(c => c.status_compra === "finalizada")
  if (!todasFinalizadas) return 5                                                        // vinculadas → ir para ESTOQUE
  return 5                                                                               // tudo ok → pronto para encerrar
}

// ─── Variantes de animação ────────────────────────────────
const slideVariants = {
  enter:  (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
}

// ─── Ícones plataforma ────────────────────────────────────
function IconInstagram() {
  return (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none">
      <defs>
        <linearGradient id="ig1" x1="0" y1="48" x2="48" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f09433"/><stop offset="25%" stopColor="#e6683c"/>
          <stop offset="50%" stopColor="#dc2743"/><stop offset="75%" stopColor="#cc2366"/>
          <stop offset="100%" stopColor="#bc1888"/>
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="11" fill="url(#ig1)"/>
      <rect x="12" y="12" width="24" height="24" rx="7" stroke="white" strokeWidth="2.5" fill="none"/>
      <circle cx="24" cy="24" r="6" stroke="white" strokeWidth="2.5" fill="none"/>
      <circle cx="32.5" cy="15.5" r="2" fill="white"/>
    </svg>
  )
}
function IconTikTok() {
  return (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none">
      <rect width="48" height="48" rx="11" fill="#010101"/>
      <path d="M33 16.5a6 6 0 01-6-6h-4v19.7a3.5 3.5 0 11-4.2-3.42V22.7a7.5 7.5 0 107.2 7.5V22.1a10 10 0 006 2V20a6 6 0 01-3-.5" fill="white"/>
    </svg>
  )
}
function IconYouTube() {
  return (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none">
      <rect width="48" height="48" rx="11" fill="#FF0000"/>
      <path d="M39 17.6A3.2 3.2 0 0036.7 15C34.2 14.4 24 14.4 24 14.4s-10.2 0-12.7.6a3.2 3.2 0 00-2.3 2.6c-.5 2-.5 6-.5 6s0 4 .5 6a3.2 3.2 0 002.3 2.6c2.5.6 12.7.6 12.7.6s10.2 0 12.7-.6A3.2 3.2 0 0039 29.4c.5-2 .5-6 .5-6s0-4-.5-5.8zM21 28.4V19.6L29.4 24 21 28.4z" fill="white"/>
    </svg>
  )
}
const PLATAFORMAS = [
  { value: "instagram", label: "Instagram", icon: <IconInstagram /> },
  { value: "tiktok",    label: "TikTok",    icon: <IconTikTok />    },
  { value: "youtube",   label: "YouTube",   icon: <IconYouTube />   },
]

// ══════════════════════════════════════════════════════════
// WIZARD — Nova Live
// ══════════════════════════════════════════════════════════
function WizardLive({ onClose, onSalvo }: { onClose: () => void; onSalvo: (id: number) => void }) {
  const qc = useQueryClient()
  const [step, setStep]     = useState(1)
  const [dir, setDir]       = useState(1)
  const [form, setForm]     = useState<LiveForm>(EMPTY_LIVE)
  const [erro, setErro]     = useState("")
  const [saving, setSaving] = useState(false)
  const [platIdx, setPlatIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const TOTAL = 3

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 280); return () => clearTimeout(t) }, [step])
  useEffect(() => {
    if (step === 2) setPlatIdx(PLATAFORMAS.findIndex(p => p.value === form.plataforma) || 0)
  }, [step]) // eslint-disable-line

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn); return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  function set(k: keyof LiveForm, v: string) { setForm(f => ({ ...f, [k]: v })); setErro("") }
  function go(next: number) { setDir(next > step ? 1 : -1); setStep(next); setErro("") }

  function advance() {
    if (step === 1 && !form.data_live) { setErro("Informe a data da live"); return }
    if (step < TOTAL) go(step + 1); else handleSalvar()
  }

  async function handleSalvar() {
    setSaving(true); setErro("")
    try {
      const nova = await apiPost<{ id: number }>("/live", { data_live: form.data_live, titulo: form.titulo || null, plataforma: form.plataforma || null, tipo: form.tipo, link_live: form.link_live || null })
      qc.invalidateQueries({ queryKey: ["lives"] }); onSalvo(nova.id)
    } catch { setErro("Erro ao criar live.") } finally { setSaving(false) }
  }

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (step === 2) {
      if (e.key === "ArrowLeft") { e.preventDefault(); setPlatIdx(i => (i - 1 + PLATAFORMAS.length) % PLATAFORMAS.length); return }
      if (e.key === "ArrowRight") { e.preventDefault(); setPlatIdx(i => (i + 1) % PLATAFORMAS.length); return }
      if (e.key === "Enter") { e.preventDefault(); set("plataforma", PLATAFORMAS[platIdx].value); go(3); return }
    }
    if (e.key === "Enter") { e.preventDefault(); advance() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, platIdx])

  const iBase = "w-full px-5 py-4 text-lg rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>Brechó Bellasu</span>
          <span style={{ color: "var(--border)" }}>|</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Nova Live</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>{step} / {TOTAL}</span>
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>
            <X size={15}/> Cancelar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative" onKeyDown={handleKey}>
        <AnimatePresence custom={dir} mode="wait">
          <motion.div key={step} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <div className="w-full max-w-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base font-bold" style={{ color: COR_LIVE }}>{step}</span>
                <ArrowRight size={14} style={{ color: COR_LIVE }}/>
              </div>

              {step === 1 && <>
                <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Data da Live</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Quando aconteceu a live? 📅</p>
                <DatePicker value={form.data_live} onChange={v => set("data_live", v)} inputClassName={iBase}/>
                <div className="mt-5">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Link da live (opcional)</label>
                  <input value={form.link_live} onChange={e => set("link_live", e.target.value)}
                    placeholder="https://instagram.com/... ou https://tiktok.com/..."
                    className={iBase} style={iSt}/>
                  <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>Instagram ou TikTok — usado ao avisar as clientes.</p>
                </div>
              </>}

              {step === 2 && <>
                <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Qual a plataforma?</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Onde a live foi transmitida.</p>
                <div className="grid grid-cols-3 gap-3">
                  {PLATAFORMAS.map((op, idx) => {
                    const sel = form.plataforma === op.value || platIdx === idx
                    return (
                      <button key={op.value} onClick={() => { set("plataforma", op.value); go(3) }}
                        onMouseEnter={() => setPlatIdx(idx)}
                        className="p-5 rounded-2xl text-center border-2 flex flex-col items-center gap-3"
                        style={{ background: sel ? "var(--accent-bg)" : "var(--bg-surface)", borderColor: sel ? "var(--accent)" : "var(--border)", color: "var(--text-primary)" }}>
                        {op.icon}
                        <p className="font-semibold text-sm">{op.label}</p>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-4 text-xs text-center" style={{ color: "var(--text-muted)" }}>
                  Use ← → para navegar · Enter para selecionar
                </p>
              </>}

              {step === 3 && <>
                <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Tipo da live?</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Define como o cartão de crédito será cobrado.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  {[
                    { value: "novidades" as const,   emoji: "✨", label: "NOVIDADES",   desc: "Lançamentos — cartão de crédito sem juros (loja absorve)" },
                    { value: "promocional" as const, emoji: "🏷️", label: "PROMOCIONAL", desc: "Promoções — cartão de crédito com juros por conta do cliente" },
                  ].map(op => (
                    <motion.button key={op.value} onClick={() => { set("tipo", op.value); advance() }}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      className="flex-1 p-6 rounded-2xl text-left border-2"
                      style={{ background: form.tipo === op.value ? "var(--accent-bg)" : "var(--bg-surface)", borderColor: form.tipo === op.value ? COR_LIVE : "var(--border)", color: "var(--text-primary)" }}>
                      <div className="text-4xl mb-3">{op.emoji}</div>
                      <p className="font-bold text-base uppercase">{op.label}</p>
                      <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>{op.desc}</p>
                    </motion.button>
                  ))}
                </div>
              </>}

              <AnimatePresence>
                {erro && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-3 text-sm" style={{ color: "#f87171" }}>{erro}</motion.p>}
              </AnimatePresence>

              {step !== 2 && step !== 3 && (
                <div className="flex items-center gap-4 mt-8">
                  <button onClick={advance} disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg disabled:opacity-60"
                    style={{ background: COR_LIVE }}>
                    {saving ? <><Loader2 size={14} className="animate-spin"/>Criando...</> : <>Continuar <ArrowRight size={15}/></>}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {step > 1 && step !== 2 && (
        <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => go(step - 1)} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            <ChevronLeft size={15}/> Voltar
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════
// WIZARD — Adicionar Compra (rápido, sem produtos)
// ══════════════════════════════════════════════════════════
function WizardCompra({ liveId, onClose, onSalvo }: { liveId: number; onClose: () => void; onSalvo: () => void }) {
  const [step, setStep]     = useState(1)
  const [dir,  setDir]      = useState(1)
  const [form, setForm]     = useState<CompraForm>(EMPTY_COMPRA)
  const [erro, setErro]     = useState("")
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const TOTAL = 4

  const [cliBusca, setCliBusca] = useState("")
  const [cliRes,   setCliRes]   = useState<Cliente[]>([])
  const [cliSel,   setCli]      = useState<Cliente | null>(null)
  const [corIdx,   setCorIdx]   = useState(0)

  useEffect(() => { const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }; document.addEventListener("keydown", fn); return () => document.removeEventListener("keydown", fn) }, [onClose])
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 280); return () => clearTimeout(t) }, [step])
  useEffect(() => {
    if (step === 2) { const idx = form.cor_sacola ? CORES_SACOLA.indexOf(form.cor_sacola) : -1; setCorIdx(idx >= 0 ? idx : 0) }
  }, [step]) // eslint-disable-line

  const buscarClientes = useCallback(async (val: string) => {
    setCliBusca(val); setCli(null)
    if (val.length < 2) { setCliRes([]); return }
    try { const res = await apiGet<{ data: Cliente[] }>(`/clientes?busca=${encodeURIComponent(val)}&limit=8`); setCliRes(res.data ?? []) }
    catch { setCliRes([]) }
  }, [])

  function selCliente(c: Cliente) {
    setCli(c); setCliBusca(c.nome); setCliRes([])
    setForm(f => ({ ...f, cliente_id: c.id, nome_cliente: c.nome, whatsapp: c.celular ?? "" }))
  }
  const { hi: cliHi, onKeyDown: cliKD, reset: resetCli } = useDropdownKeyNav(cliRes, selCliente)

  function set(k: keyof CompraForm, v: string) { setForm(f => ({ ...f, [k]: v })); setErro("") }
  function go(next: number) { setDir(next > step ? 1 : -1); setStep(next); setErro("") }

  function advance() {
    if (step === 1) {
      const nome = form.nome_cliente.trim() || cliBusca.trim()
      if (!nome) { setErro("Nome do cliente é obrigatório"); return }
      if (!form.nome_cliente.trim()) set("nome_cliente", cliBusca.trim())
    }
    if (step < TOTAL) go(step + 1)
  }

  async function salvar() {
    if (!form.valor_total) { setErro("Informe o valor total"); return }
    setSaving(true); setErro("")
    try {
      await apiPost(`/live/${liveId}/compras`, {
        cliente_id:        form.cliente_id ?? undefined,
        nome_cliente:      form.nome_cliente || cliBusca.trim(),
        whatsapp:          form.whatsapp || undefined,
        cor_sacola:        form.cor_sacola || undefined,
        numero_sacola:     form.numero_sacola || undefined,
        quantidade_itens:  parseInt(form.quantidade_itens) || 1,
        valor_total:       parseFloat(form.valor_total.replace(/\./g, "").replace(",", ".")) || 0,
        desconto:          parseFloat(form.desconto.replace(/\./g, "").replace(",", ".")) || 0,
        observacao:        form.observacao || undefined,
        link_pagamento:    form.link_pagamento || undefined,
        status_compra:     "cadastrada",
      })
      onSalvo(); onClose()
    } catch { setErro("Erro ao registrar compra.") } finally { setSaving(false) }
  }

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (step === 1) { if (e.key === "Enter" && cliRes.length === 0) { e.preventDefault(); advance() }; return }
    if (step === 2) {
      if (e.key === "ArrowDown") { e.preventDefault(); setCorIdx(i => { const n = (i+1)%CORES_SACOLA.length; setForm(f => ({...f, cor_sacola: CORES_SACOLA[n]})); return n }); return }
      if (e.key === "ArrowUp")   { e.preventDefault(); setCorIdx(i => { const n = (i-1+CORES_SACOLA.length)%CORES_SACOLA.length; setForm(f => ({...f, cor_sacola: CORES_SACOLA[n]})); return n }); return }
      if (e.key === "Enter" && form.cor_sacola) { e.preventDefault(); advance(); return }
    }
    if (e.key === "Enter" && step < TOTAL) { e.preventDefault(); advance() }
    if (e.key === "Enter" && step === TOTAL) { e.preventDefault(); salvar() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, cliRes, corIdx])

  const iBase = "w-full px-5 py-4 text-lg rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }
  const iSm = "w-full px-4 py-3 text-base rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: COR_LIVE }}>Brechó Bellasu</span>
          <span style={{ color: "var(--border)" }}>|</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Adicionar Compra</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>{step} / {TOTAL}</span>
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>
            <X size={15}/> Cancelar
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-hidden relative" onKeyDown={handleKey}>
        <AnimatePresence custom={dir} mode="wait">
          <motion.div key={step} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 overflow-y-auto py-10">
            <div className="w-full max-w-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base font-bold" style={{ color: COR_LIVE }}>{step}</span>
                <ArrowRight size={14} style={{ color: COR_LIVE }}/>
              </div>

              {/* Step 1 — Cliente */}
              {step === 1 && <>
                <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Qual cliente?</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Busque pelo nome ou WhatsApp cadastrado.</p>
                <div className="relative mb-2">
                  <input ref={inputRef} value={cliBusca}
                    onChange={e => { buscarClientes(e.target.value); resetCli() }}
                    onKeyDown={cliKD}
                    placeholder="NOME OU TELEFONE..."
                    className="w-full px-4 py-4 text-base rounded-xl outline-none transition-all border"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    autoComplete="off"/>
                </div>
                {cliRes.length > 0 && (
                  <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    {cliRes.map((c, idx) => (
                      <button key={c.id} onMouseDown={() => selCliente(c)}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                        style={{ borderBottom: "1px solid var(--border)", background: cliHi === idx ? "var(--bg-hover)" : "var(--bg-surface)" }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                          {c.nome[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.nome}</p>
                          {c.celular && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.celular}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {cliSel && (
                  <div className="mt-2 px-4 py-2 rounded-xl flex items-center gap-2"
                    style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <Check size={13} style={{ color: "#16a34a" }}/>
                    <p className="text-sm font-medium" style={{ color: "#15803d" }}>{cliSel.nome} selecionado</p>
                  </div>
                )}
                <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  Digite o nome e pressione Enter se o cliente não estiver cadastrado.
                </p>
                {/* WhatsApp inline */}
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>WhatsApp</p>
                  <input value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)}
                    placeholder="(16) 99999-9999"
                    className={iBase} style={iSt}/>
                </div>
              </>}

              {/* Step 2 — Sacola */}
              {step === 2 && <>
                <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Sacola</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Informe a cor e o número da sacola.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>COR DA SACOLA</p>
                    <div className="relative">
                      <select value={form.cor_sacola} onChange={e => { const i = CORES_SACOLA.indexOf(e.target.value); setCorIdx(i >= 0 ? i : 0); set("cor_sacola", e.target.value) }}
                        className="w-full px-4 py-4 text-base rounded-2xl outline-none transition-all border-2 appearance-none pr-10 font-medium"
                        style={{ background: "var(--bg-surface)", borderColor: form.cor_sacola ? "var(--accent)" : "var(--border)", color: "var(--text-primary)" }}>
                        <option value="">Selecione...</option>
                        {CORES_SACOLA.map(cor => <option key={cor} value={cor}>{cor.toUpperCase()}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}/>
                    </div>
                    <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>↑↓ para navegar · Enter para avançar</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>NÚMERO DA SACOLA</p>
                    <input ref={inputRef} value={form.numero_sacola} onChange={e => set("numero_sacola", e.target.value)}
                      placeholder="Ex: 43" className="w-full px-4 py-4 text-base rounded-2xl outline-none transition-all border-2"
                      style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }} autoComplete="off"/>
                  </div>
                </div>
              </>}

              {/* Step 3 — Qtd e Observação */}
              {step === 3 && <>
                <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Quantidades</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Quantidade de itens nesta sacola.</p>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>QTD DE ITENS</p>
                  <input ref={inputRef} type="number" min="1" value={form.quantidade_itens}
                    onChange={e => set("quantidade_itens", e.target.value)}
                    className={iBase} style={iSt}/>
                </div>
              </>}

              {/* Step 4 — Valor */}
              {step === 4 && <>
                <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Valor da compra</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Valor total cobrado nesta sacola.</p>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>VALOR TOTAL</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold" style={{ color: "var(--text-muted)" }}>R$</span>
                    <input ref={inputRef} value={form.valor_total} onChange={e => set("valor_total", e.target.value)}
                      onBlur={() => { const n = parseFloat(form.valor_total.replace(/\./g,"").replace(",",".")); if (!isNaN(n) && n > 0) set("valor_total", n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })) }}
                      placeholder="0,00" className={iBase + " pl-12"} style={iSt}/>
                  </div>
                </div>

                {/* Resumo da compra */}
                <div className="mt-6 rounded-2xl p-4 space-y-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Resumo</p>
                  {[
                    { l: "Cliente",   v: form.nome_cliente || cliBusca || "—" },
                    { l: "Sacola",    v: [form.cor_sacola, form.numero_sacola ? `#${form.numero_sacola}` : ""].filter(Boolean).join(" ") || "—" },
                    { l: "Itens",     v: `${form.quantidade_itens} item(ns)` },
                    { l: "Total",     v: form.valor_total ? fmtBRL(parseFloat(form.valor_total.replace(",","."))) : "—" },
                  ].map(r => (
                    <div key={r.l} className="flex justify-between text-sm">
                      <span style={{ color: "var(--text-muted)" }}>{r.l}</span>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{r.v}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex gap-3">
                  <motion.button onClick={salvar} disabled={saving} whileTap={{ scale: 0.97 }}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white shadow-lg disabled:opacity-60"
                    style={{ background: COR_LIVE }}>
                    {saving ? <><Loader2 size={14} className="animate-spin"/>Salvando...</> : <><ShoppingBag size={15}/>Registrar Compra</>}
                  </motion.button>
                </div>
              </>}

              <AnimatePresence>
                {erro && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-3 text-sm" style={{ color: "#f87171" }}>{erro}</motion.p>}
              </AnimatePresence>

              {step < TOTAL && (
                <div className="mt-8 flex items-center gap-4">
                  <button onClick={advance}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg"
                    style={{ background: COR_LIVE }}>
                    Continuar <ArrowRight size={15}/>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {step > 1 && (
        <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => go(step - 1)} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            <ChevronLeft size={15}/> Voltar
          </button>
          {step < TOTAL && <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Pressione <kbd className="px-1 py-0.5 rounded text-[10px] font-mono"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>Enter</kbd> para avançar
          </p>}
        </div>
      )}
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════
// MODAL — Vincular Produtos a uma Compra
// ══════════════════════════════════════════════════════════
function ModalVinculo({
  liveId, compra, onClose, onAtualizado,
}: { liveId: number; compra: Compra; onClose: () => void; onAtualizado: () => void }) {
  const [busca,   setBusca]   = useState("")
  const [prodRes, setProdRes] = useState<Array<{ id: number; nome: string; preco_venda?: number; estoque_atual?: number }>>([])
  const [form,    setForm]    = useState({ produto_id: 0, nome_produto: "", quantidade: "", preco_original: "", preco_live: "" })
  const [saving,  setSaving]  = useState(false)
  const [erro,    setErro]    = useState("")
  const [finalizando, setFin] = useState(false)

  const { data: produtos, refetch } = useQuery({
    queryKey: ["live-compra-produtos", compra.id],
    queryFn: () => apiGet<ProdutoVinculo[]>(`/live/${liveId}/compras/${compra.id}/produtos`),
    initialData: [],
  })

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn); return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  const buscarProdutos = useCallback(async (val: string) => {
    setBusca(val)
    if (val.length < 2) { setProdRes([]); return }
    try {
      const res = await apiGet<{ data: typeof prodRes }>(`/produtos?busca=${encodeURIComponent(val)}&limit=8`)
      setProdRes(res.data ?? [])
    } catch { setProdRes([]) }
  }, [])

  function selecionarProd(p: typeof prodRes[0]) {
    // preco_venda pode vir como número OU string (numeric via PostgREST) — converte antes de formatar
    const precoNum = Number(p.preco_venda) || 0
    const preco = precoNum > 0 ? precoNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""
    setForm({ produto_id: p.id, nome_produto: p.nome, quantidade: "1", preco_original: preco, preco_live: "" })
    setBusca(p.nome); setProdRes([])
  }

  async function vincular() {
    if (!form.nome_produto) { setErro("Selecione um produto"); return }
    setSaving(true); setErro("")
    try {
      await apiPost(`/live/${liveId}/compras/${compra.id}/produtos`, {
        produto_id: form.produto_id || undefined,
        nome_produto: form.nome_produto,
        quantidade: parseInt(String(form.quantidade)) || 1,
        preco_original: parseFloat(String(form.preco_original).replace(/\./g, "").replace(",", ".")) || 0,
        preco_live: parseFloat(String(form.preco_live).replace(/\./g, "").replace(",", ".")) || 0,
      })
      setBusca(""); setProdRes([])
      setForm({ produto_id: 0, nome_produto: "", quantidade: "", preco_original: "", preco_live: "" })
      refetch(); onAtualizado()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao vincular produto.")
    } finally { setSaving(false) }
  }

  async function remover(itemId: number) {
    try {
      await apiDelete(`/live/${liveId}/compras/${compra.id}/produtos?item_id=${itemId}`)
      refetch(); onAtualizado()
    } catch { setErro("Erro ao remover produto.") }
  }

  async function finalizar() {
    setFin(true)
    try {
      await apiPost(`/live/${liveId}/compras/${compra.id}/finalizar`, {})
      onAtualizado(); onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao finalizar.")
    } finally { setFin(false) }
  }

  const totalVinculado = (produtos ?? []).reduce((s, p) => s + p.quantidade, 0)
  const qtdEsperada = compra.quantidade_itens ?? 0
  const progresso = qtdEsperada > 0 ? Math.min(100, (totalVinculado / qtdEsperada) * 100) : 0
  const podeFinalizar = totalVinculado >= qtdEsperada && (produtos ?? []).every(p => p.estoque_baixado)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-x-0 bottom-0 z-[15] flex"
      style={{ top: "var(--topbar-height, 52px)", background: "var(--bg-base)" }}>
      <motion.div initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="w-full flex flex-col overflow-hidden"
        style={{ background: "var(--bg-base)" }}>

        {/* ── Header ── */}
        <div className="shrink-0 flex items-center justify-between px-10 py-6" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black"
              style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
              {compra.nome_cliente[0].toUpperCase()}
            </div>
            <div>
              <p className="font-black text-lg uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>{compra.nome_cliente}</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                {[compra.cor_sacola, compra.numero_sacola ? `#${compra.numero_sacola}` : ""].filter(Boolean).join(" ") || "Sem sacola"} · {fmtBRL(compra.valor_total)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Progresso circular inline */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>VÍNCULO</p>
                <p className="text-2xl font-black leading-none" style={{ color: progresso >= 100 ? "#10b981" : "var(--accent)" }}>
                  {Math.round(progresso)}%
                </p>
              </div>
              <div className="w-36 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-surface)" }}>
                <motion.div animate={{ width: `${progresso}%` }} transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-full" style={{ background: progresso >= 100 ? "#10b981" : "var(--accent)" }}/>
              </div>
              <p className="text-sm font-black" style={{ color: "var(--text-secondary)" }}>
                {totalVinculado}/{qtdEsperada}
              </p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-muted)" }}>
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* ── Body: 2 colunas ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Esquerda: lista de produtos vinculados */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: "1px solid var(--border)" }}>
            <div className="px-10 py-5 shrink-0 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                PRODUTOS VINCULADOS <span style={{ color: "var(--accent)" }}>({(produtos ?? []).length})</span>
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-10 py-6 space-y-3">
              <AnimatePresence>
                {(produtos ?? []).map((p, i) => (
                  <motion.div key={p.id}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                    transition={{ delay: i * 0.04, type: "spring", stiffness: 320, damping: 26 }}
                    whileHover={{ x: 3 }}
                    className="flex items-center gap-4 px-5 py-4 rounded-2xl"
                    style={{ background: "var(--bg-surface)", border: `1px solid ${p.estoque_baixado ? "rgba(16,185,129,0.25)" : "var(--border)"}` }}>
                    <motion.div animate={p.estoque_baixado ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.4 }}
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: p.estoque_baixado ? "rgba(16,185,129,0.15)" : "var(--accent-bg)" }}>
                      {p.estoque_baixado
                        ? <CheckCircle2 size={18} style={{ color: "#10b981" }}/>
                        : <Package size={18} style={{ color: "var(--accent)" }}/>}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black uppercase tracking-wide truncate" style={{ color: "var(--text-primary)" }}>{p.nome_produto}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{p.quantidade}x</span>
                        <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{fmtBRL(p.preco_live)}</span>
                        {p.preco_original !== p.preco_live && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                            -{fmtBRL(p.preco_original - p.preco_live)}
                          </span>
                        )}
                      </div>
                    </div>
                    {p.estoque_baixado && (
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-wide" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                        ESTOQUE ✓
                      </span>
                    )}
                    <motion.button onClick={() => remover(p.id)}
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center opacity-30 hover:opacity-80 transition-opacity"
                      style={{ color: "#f87171" }}>
                      <Trash2 size={14}/>
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {(produtos ?? []).length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="h-48 flex flex-col items-center justify-center gap-3 rounded-2xl"
                  style={{ border: "2px dashed var(--border)" }}>
                  <Package size={36} className="opacity-20" style={{ color: "var(--text-muted)" }}/>
                  <p className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>NENHUM PRODUTO VINCULADO</p>
                </motion.div>
              )}
            </div>

            {/* Botão finalizar */}
            {podeFinalizar && (
              <div className="px-10 pb-8 shrink-0">
                <motion.button onClick={finalizar} disabled={finalizando}
                  whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
                  animate={{ boxShadow: ["0 0 0px #10b98100","0 0 20px #10b98155","0 0 0px #10b98100"] }}
                  transition={{ boxShadow: { repeat: Infinity, duration: 2 }, scale: {}, y: {} }}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-black uppercase tracking-wide text-white"
                  style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                  {finalizando ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
                  FINALIZAR COMPRA
                </motion.button>
              </div>
            )}
          </div>

          {/* Direita: formulário de vínculo */}
          <div className="w-[520px] shrink-0 flex flex-col overflow-hidden" style={{ background: "var(--bg-card)" }}>
            <div className="px-10 py-5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>VINCULAR PRODUTO</p>
            </div>

            <div className="flex-1 overflow-y-auto px-10 py-6 space-y-5">
              {/* Busca */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}/>
                <input value={busca} onChange={e => buscarProdutos(e.target.value)}
                  placeholder="BUSCAR PRODUTO..."
                  className="w-full pl-10 pr-4 py-3.5 text-sm font-semibold rounded-xl outline-none border-2 uppercase tracking-wide transition-all focus:border-[color:var(--accent)]"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
                {prodRes.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-xl z-10 overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    {prodRes.map(p => (
                      <button key={p.id} onClick={() => selecionarProd(p)}
                        className="w-full px-4 py-3 text-left flex items-center justify-between transition-colors hover:bg-[var(--bg-hover)]"
                        style={{ borderBottom: "1px solid var(--border)" }}>
                        <span className="text-sm font-semibold uppercase" style={{ color: "var(--text-primary)" }}>{p.nome}</span>
                        <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{fmtBRL(p.preco_venda ?? 0)} · est:{p.estoque_atual ?? 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Produto selecionado */}
              <AnimatePresence>
                {form.nome_produto && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl p-4 space-y-3"
                    style={{ background: "var(--accent-bg)", border: "1px solid var(--accent)" }}>
                    <p className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                      {form.nome_produto}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>QTD</p>
                        <input type="number" step="1" min="1" value={form.quantidade} placeholder="0"
                          onChange={e => setForm(prev => ({ ...prev, quantidade: e.target.value }))}
                          className="w-full px-3 py-2.5 text-sm font-bold rounded-xl outline-none border-2 transition-all focus:border-[color:var(--accent)]"
                          style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>PREÇO ORIGINAL</p>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>R$</span>
                          <input value={form.preco_original}
                            onChange={e => setForm(prev => ({ ...prev, preco_original: e.target.value }))}
                            onBlur={() => { const n = parseFloat(String(form.preco_original).replace(/\./g,"").replace(",",".")); if (!isNaN(n) && n > 0) setForm(prev => ({ ...prev, preco_original: n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) })) }}
                            placeholder="0,00"
                            className="w-full pl-9 pr-3 py-2.5 text-sm font-bold rounded-xl outline-none border-2 transition-all focus:border-[color:var(--accent)]"
                            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>PREÇO LIVE</p>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>R$</span>
                          <input value={form.preco_live}
                            onChange={e => setForm(prev => ({ ...prev, preco_live: e.target.value }))}
                            onBlur={() => { const n = parseFloat(String(form.preco_live).replace(/\./g,"").replace(",",".")); if (!isNaN(n) && n > 0) setForm(prev => ({ ...prev, preco_live: n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) })) }}
                            placeholder="0,00"
                            className="w-full pl-9 pr-3 py-2.5 text-sm font-bold rounded-xl outline-none border-2 transition-all focus:border-[color:var(--accent)]"
                            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {erro && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <AlertTriangle size={13} style={{ color: "#f87171" }}/>
                    <p className="text-xs font-semibold" style={{ color: "#f87171" }}>{erro}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Botão vincular */}
            <div className="px-10 pb-8 shrink-0">
              <motion.button onClick={vincular} disabled={saving || !form.nome_produto}
                whileHover={form.nome_produto ? { scale: 1.02, y: -2 } : {}}
                whileTap={form.nome_produto ? { scale: 0.98 } : {}}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-black uppercase tracking-wide text-white transition-all disabled:opacity-40"
                style={{ background: "var(--accent)" }}>
                {saving ? <Loader2 size={16} className="animate-spin"/> : <Link2 size={16}/>}
                VINCULAR PRODUTO
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════
// MODAL — Avisar Clientes (aviso de live p/ opt-in de lives)
// ══════════════════════════════════════════════════════════
function ModalAvisoLive({ liveId, tipo, linkAtual, onClose, onSuccess }: {
  liveId: number; tipo: string; linkAtual: string
  onClose: () => void; onSuccess: () => void
}) {
  const [link, setLink] = useState(linkAtual)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)

  const previewMsg = tipo === "promocional"
    ? `🏷️ Estamos AO VIVO com PROMOÇÕES agora!\n\nAcesse aqui: ${link || "[link]"}\n\nCorre! 🔥`
    : `✨ Estamos AO VIVO com NOVIDADES agora!\n\nAcesse aqui: ${link || "[link]"}\n\nTe esperamos! 💖`

  async function disparar() {
    if (!link.trim()) { setResultado({ ok: false, texto: "Cole o link da live primeiro." }); return }
    setEnviando(true); setResultado(null)
    try {
      const res = await apiPost<{ enviados: number; erros?: number; total?: number; mensagem?: string }>(`/live/${liveId}/aviso`, { link })
      if (res.enviados === 0) {
        setResultado({ ok: false, texto: res.mensagem ?? "Nenhum cliente com opt-in para lives." })
      } else {
        setResultado({ ok: true, texto: `Aviso enviado para ${res.enviados} cliente(s)${res.erros ? ` (${res.erros} falha(s))` : ""}.` })
        onSuccess()
      }
    } catch (e) {
      setResultado({ ok: false, texto: (e as Error).message || "Erro ao disparar aviso." })
    } finally { setEnviando(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="font-bold text-sm inline-flex items-center gap-2" style={{ color: "#10b981" }}>
            <Radio size={16}/> Avisar Clientes da Live
          </span>
          <button onClick={onClose}><X size={18} style={{ color: "var(--text-muted)" }} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Envia para todas as clientes com consentimento de <b>avisos de lives</b> confirmado.
            Tipo: <b>{tipo === "promocional" ? "Promocional 🏷️" : "Novidades ✨"}</b>.
          </p>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Link da live (Instagram/TikTok)</label>
            <input value={link} onChange={e => setLink(e.target.value)} autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              placeholder="https://instagram.com/..." />
          </div>
          <div className="rounded-lg p-3 text-xs whitespace-pre-line" style={{ background: "var(--bg-base)", color: "var(--text-secondary)" }}>
            {previewMsg}
          </div>
          {resultado && (
            <p className={cn("text-xs px-3 py-2 rounded-lg", resultado.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
              {resultado.texto}
            </p>
          )}
          <button onClick={disparar} disabled={enviando}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "#10b981" }}>
            {enviando ? <Loader2 size={16} className="animate-spin"/> : <Send size={15}/>}
            {enviando ? "Disparando..." : "Disparar Aviso Agora"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════
// MODAL — Disparar Mensagens
// ══════════════════════════════════════════════════════════
function ModalDisparar({ liveId, liveTitulo, liveData, compras, onClose, onSuccess }: {
  liveId: number; liveTitulo: string; liveData: string
  compras: Compra[]; onClose: () => void; onSuccess: () => void
}) {
  type Fase = "preview" | "disparando" | "resultado"
  const [fase, setFase] = useState<Fase>("preview")
  const [resultado, setResultado] = useState<{ enviadas: number; erros: number; resultados: Array<{ id: number; cliente: string; numero: string; status: string; detalhe?: string }> } | null>(null)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape" && fase !== "disparando") onClose() }
    document.addEventListener("keydown", fn); return () => document.removeEventListener("keydown", fn)
  }, [onClose, fase])

  const pendentes = compras.filter(c => !c.msg_status || c.msg_status === "pendente" || c.msg_status === "erro")
  const ex = pendentes[0]

  function fmtVal(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) }
  function fmtD(d?: string) { return d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR") }

  function prazo48h() {
    const dias = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"]
    const d = new Date()
    d.setHours(d.getHours() + 48)
    return dias[d.getDay()]
  }

  function msgPreview(c: typeof ex) {
    if (!c) return ""
    const linkPagamento = c.link_pagamento || ""
    const diaPrazo = prazo48h()
    return (
`Olá! 💖

Obrigada pela sua participação em nossa live. Suas peças foram separadas com carinho. 🛍️

*Resumo da sua compra:*

📅 Data da compra: ${fmtD(c.data_compra)}
🎥 Data da live: ${fmtD(liveData)}
🛍️ Sacola: ${c.numero_sacola || "—"}
🎨 Cor da Sacola: ${c.cor_sacola || "—"}
📦 Quantidade de Itens: ${c.quantidade_itens || 1}
💰 Valor total: ${fmtVal(c.valor_total)}

*Pagamento:*

O pagamento deve ser realizado até ${diaPrazo} às 23:59, via PIX ou Cartão, para manter suas peças reservadas com carinho. 💖

💳 Link para pagamento:
${linkPagamento || "[link será gerado em breve]"}

*Endereço para retirada:*

📍 Rua Barão do Amazonas, 1035 - Centro - Rib. Preto - SP

*Entrega:*

Caso queira receber por entrega, envie seu endereço completo e CEP.
O valor fixo da entrega é de R$ 15,00. 🛵

⚠️ *ATENÇÃO*
É NECESSÁRIO TER ALGUÉM NO LOCAL PARA RECEBER O PEDIDO. CASO CONTRÁRIO, SERÁ COBRADA UMA NOVA TAXA PARA RETORNO. SE PREFERIR, VOCÊ PODE OPTAR PELA RETIRADA OU ENTREGA POR CONTA PRÓPRIA.

⚠️ *Importante:*
Peças de promoção não possuem troca.

Obrigada novamente pela sua compra. Espero que goste de tudo! 💖`
    )
  }

  async function disparar() {
    setFase("disparando")
    try {
      const res = await apiPost<{ enviadas: number; erros: number; resultados: Array<{ id: number; cliente: string; numero: string; status: string; detalhe?: string }> }>(`/live/${liveId}/disparar`, {})
      setResultado(res); setFase("resultado"); onSuccess()
    } catch { setFase("preview") }
  }

  function WhatsAppText({ text }: { text: string }) {
    return (
      <span>
        {text.split("\n").map((line, i) => {
          const parts = line.split(/(\*[^*]+\*)/g)
          return (
            <span key={i}>
              {parts.map((p, j) =>
                p.startsWith("*") && p.endsWith("*") && p.length > 2
                  ? <strong key={j} className="font-semibold">{p.slice(1,-1)}</strong>
                  : <span key={j}>{p}</span>
              )}
              {i < text.split("\n").length - 1 && <br/>}
            </span>
          )
        })}
      </span>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-x-0 bottom-0 z-[15] flex flex-col"
      style={{ top: "var(--topbar-height, 52px)", background: "var(--bg-base)" }}>
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: COR_LIVE }}>Disparar Mensagens</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}>
            {pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}
          </span>
        </div>
        {fase !== "disparando" && (
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>
            <X size={15}/> {fase === "resultado" ? "Fechar" : "Cancelar"}
          </button>
        )}
      </div>

      {fase === "disparando" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
            <Send size={40} style={{ color: "var(--accent)" }}/>
          </motion.div>
          <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Enviando mensagens...</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aguarde, estamos notificando todas as clientes.</p>
        </div>
      )}

      {fase === "resultado" && resultado && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 15 }}
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: resultado.erros === 0 ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)" }}>
            {resultado.erros === 0
              ? <CheckCircle2 size={40} style={{ color: "#10b981" }}/>
              : <AlertTriangle size={40} style={{ color: "#f59e0b" }}/>}
          </motion.div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {resultado.enviadas} enviada{resultado.enviadas !== 1 ? "s" : ""}
            </p>
            {resultado.erros > 0 && <p className="text-sm mt-1" style={{ color: "#f87171" }}>{resultado.erros} com erro</p>}
          </div>
          <div className="w-full max-w-md space-y-2">
            {resultado.resultados.map(r => (
              <div key={r.id} className="px-4 py-2.5 rounded-xl"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>{r.cliente}</span>
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                    r.status === "enviada" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
                    {r.status}
                  </span>
                </div>
                {r.detalhe && (
                  <p className="text-[10px] mt-1 font-mono" style={{ color: "var(--text-muted)" }}>{r.detalhe}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {fase === "preview" && (
        <div className="flex-1 overflow-hidden flex">
          {/* Lista de clientes */}
          <div className="w-64 shrink-0 overflow-y-auto" style={{ borderRight: "1px solid var(--border)" }}>
            <p className="px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
              Clientes ({pendentes.length})
            </p>
            {pendentes.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                  {c.nome_cliente[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.nome_cliente}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{fmtBRL(c.valor_total)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Preview mensagem */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                <p className="text-xs font-bold text-white">B</p>
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Brechó Bellasu</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4" style={{ background: "#0b141a" }}>
              {ex ? (
                <div className="flex justify-end mb-2">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg" style={{ background: "#005c4b" }}>
                    <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#e9edef" }}>
                      <WhatsAppText text={msgPreview(ex)}/>
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-2">
                      <p className="text-[10px]" style={{ color: "rgba(233,237,239,0.55)" }}>
                        {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <Check size={14} style={{ color: "#53bdeb" }}/>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm" style={{ color: "rgba(233,237,239,0.4)" }}>Nenhuma compra pendente</p>
              )}
            </div>
            <div className="px-4 py-3 shrink-0" style={{ background: "rgba(37,211,102,0.06)", borderTop: "1px solid var(--border)" }}>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                ℹ️ Prévia baseada na 1ª compra pendente.
              </p>
            </div>
          </div>
        </div>
      )}

      {fase === "preview" && (
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {pendentes.length} mensagem{pendentes.length !== 1 ? "s" : ""} será{pendentes.length !== 1 ? "ão" : ""} enviada{pendentes.length !== 1 ? "s" : ""}
          </p>
          <motion.button onClick={disparar} disabled={!pendentes.length} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white shadow-lg disabled:opacity-40"
            style={{ background: "#25d366" }}>
            <Send size={15}/> Disparar Agora
          </motion.button>
        </div>
      )}
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════
// MODAL EDITAR COMPRA
// ══════════════════════════════════════════════════════════
function ModalEditarCompra({ liveId, compra, onClose, onSalvo }: { liveId: number; compra: Compra; onClose: () => void; onSalvo: () => void }) {
  const [form, setForm] = useState({
    nome_cliente: compra.nome_cliente ?? "",
    whatsapp: compra.whatsapp ?? "",
    cor_sacola: compra.cor_sacola ?? "",
    numero_sacola: compra.numero_sacola ?? "",
    quantidade_itens: String(compra.quantidade_itens ?? 1),
    valor_total: (compra.valor_total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
    desconto: (compra.desconto ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState("")

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function salvar() {
    setSaving(true); setErro("")
    try {
      await apiPatch(`/live/${liveId}/compras/${compra.id}`, {
        nome_cliente: form.nome_cliente,
        whatsapp: form.whatsapp || null,
        cor_sacola: form.cor_sacola || null,
        numero_sacola: form.numero_sacola || null,
        quantidade_itens: parseInt(form.quantidade_itens) || 1,
        valor_total: parseFloat(form.valor_total.replace(/\./g, "").replace(",", ".")) || 0,
        desconto: parseFloat(form.desconto.replace(/\./g, "").replace(",", ".")) || 0,
      })
      onSalvo()
    } catch { setErro("Erro ao salvar alterações.") } finally { setSaving(false) }
  }

  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }
  const iCls = "w-full px-4 py-3 text-sm rounded-xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>Editar Compra</h2>
          <button onClick={onClose}><X size={18} style={{ color: "var(--text-muted)" }}/></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>CLIENTE</p>
            <input value={form.nome_cliente} onChange={e => set("nome_cliente", e.target.value)} className={iCls} style={iSt}/>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>WHATSAPP</p>
            <input value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} className={iCls} style={iSt}/>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>QTD DE ITENS</p>
            <input type="number" min="1" value={form.quantidade_itens} onChange={e => set("quantidade_itens", e.target.value)} className={iCls} style={iSt}/>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>COR DA SACOLA</p>
            <select value={form.cor_sacola} onChange={e => set("cor_sacola", e.target.value)} className={iCls} style={iSt}>
              <option value="">Selecione</option>
              {CORES_SACOLA.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>N. SACOLA</p>
            <input value={form.numero_sacola} onChange={e => set("numero_sacola", e.target.value)} className={iCls} style={iSt}/>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>VALOR TOTAL</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>R$</span>
              <input value={form.valor_total} onChange={e => set("valor_total", e.target.value)}
                onBlur={() => { const n = parseFloat(form.valor_total.replace(/\./g,"").replace(",",".")); if (!isNaN(n) && n > 0) set("valor_total", n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })) }}
                className={iCls + " pl-10"} style={iSt}/>
            </div>
          </div>

        </div>

        {erro && <p className="text-xs font-semibold" style={{ color: "#f87171" }}>{erro}</p>}

        <div className="flex gap-3 pt-2">
          <motion.button onClick={salvar} disabled={saving} whileTap={{ scale: 0.97 }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60"
            style={{ background: COR_LIVE }}>
            {saving ? <><Loader2 size={14} className="animate-spin"/>Salvando...</> : <><Save size={14}/>Salvar Alterações</>}
          </motion.button>
          <button onClick={onClose} className="px-5 py-3 rounded-xl text-sm font-bold" style={{ background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            Cancelar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════
// TELA DETALHE DA LIVE
// ══════════════════════════════════════════════════════════
function TelaLive({ liveId, onVoltar }: { liveId: number; onVoltar: () => void }) {
  const qc = useQueryClient()
  const [modalCompra, setModalCompra]   = useState(false)
  const [modalDisparar, setModalDisp]   = useState(false)
  const [modalAviso, setModalAviso]     = useState(false)
  const [modalVinculo, setModalVinculo] = useState<Compra | null>(null)
  const [erroEnc, setErroEnc] = useState("")
  const [encerrando, setEnc]  = useState(false)
  const [excluindo, setExc]   = useState(false)
  const [editCompra, setEditCompra] = useState<Compra | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["live-detalhe", liveId],
    queryFn: async () => {
      const live = await apiGet<LiveDetalhe>(`/live/${liveId}`)
      // Sincroniza pagamentos em background (silencioso)
      if (live?.compras?.some((c: Compra) => c.link_pagamento && c.pagamento_status !== "PAGO")) {
        apiPost(`/live/${liveId}/sync-pagamentos`, {}).catch(() => {})
      }
      return live
    },
    staleTime: 0,         // sempre busca dados frescos ao invalidar
    refetchInterval: 15_000,
  })

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }}/>
      </div>
    )
  }

  const live = data
  const compras = live.compras ?? []
  const etapa = calcEtapa(live)
  const statusCfg = STATUS_LIVE[live.status ?? "aberta"] ?? STATUS_LIVE.aberta

  // Métricas
  const totalClientes  = compras.length
  const totalArrecadado = compras.reduce((s, c) => s + c.valor_total, 0)
  const msgEnviadas    = compras.filter(c => c.msg_status === "enviada").length
  const msgPendentes   = compras.filter(c => !c.msg_status || c.msg_status === "pendente" || c.msg_status === "erro").length
  const aguardVinculo  = compras.filter(c => c.status_compra === "aguardando_vinculo" || c.status_compra === "vinculo_parcial").length
  const finalizadas    = compras.filter(c => c.status_compra === "finalizada").length

  const plataformaIcon = PLATAFORMAS.find(p => p.value === live.plataforma)?.icon

  async function encerrar() {
    setErroEnc(""); setEnc(true)
    try {
      await apiPost(`/live/${liveId}/encerrar`, {})
      qc.invalidateQueries({ queryKey: ["lives"] }); refetch()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao encerrar."
      setErroEnc(msg)
    } finally { setEnc(false) }
  }

  async function excluir() {
    if (!confirm("Excluir esta live? Esta ação não pode ser desfeita.")) return
    setExc(true)
    try { await apiDelete(`/live/${liveId}`); qc.invalidateQueries({ queryKey: ["lives"] }); onVoltar() }
    catch { } finally { setExc(false) }
  }

  // Guia contextual
  function guia(): { msg: string; acao?: string } {
    if (!compras.length) return { msg: "Nenhuma compra cadastrada ainda. Clique em \"Adicionar Compra\" para iniciar.", acao: "compra" }
    if (msgPendentes > 0 && live.status !== "disparada") return { msg: `${compras.length} compra(s) cadastrada(s). Agora você pode disparar as mensagens para as clientes.`, acao: "disparar" }
    if (aguardVinculo > 0) return { msg: `Mensagens enviadas. Agora vincule os produtos vendidos para dar baixa no estoque.` }
    if (finalizadas === compras.length && live.status !== "encerrada") return { msg: "Todas as compras foram conferidas. A live já pode ser encerrada! ✅" }
    if (live.status === "encerrada") return { msg: "Live encerrada com sucesso! Todos os estoques foram atualizados." }
    return { msg: "Continue vinculando os produtos nas compras pendentes." }
  }
  const g = guia()

  const podeEncerrar = live.status !== "encerrada" && compras.length > 0 && compras.every(c => c.status_compra === "finalizada")

  const METRICAS = [
    { icon: <Users size={14}/>,        label: "CLIENTES",      val: totalClientes,           cor: "#6366f1" },
    { icon: <TrendingUp size={14}/>,   label: "TOTAL",         val: fmtBRL(totalArrecadado), cor: "#10b981" },
    { icon: <MessageSquare size={14}/>,label: "MSGS ENVIADAS", val: msgEnviadas,             cor: "#3b82f6" },
    { icon: <Clock size={14}/>,        label: "MSG PENDENTES", val: msgPendentes,            cor: "#f59e0b" },
    { icon: <Link2 size={14}/>,        label: "AG. VÍNCULO",   val: aguardVinculo,           cor: "#8b5cf6" },
    { icon: <CheckCircle2 size={14}/>, label: "FINALIZADAS",   val: finalizadas,             cor: "#10b981" },
  ]

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100%", background: "var(--bg-base)" }}>

      {/* ══ TOP BAR ══ */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="shrink-0 flex items-center gap-4 px-5 py-2.5"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-base)" }}>

        {/* Voltar */}
        <motion.button onClick={onVoltar} whileHover={{ x: -2 }} whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider shrink-0"
          style={{ color: "var(--text-muted)" }}>
          <ChevronLeft size={14}/> LIVES
        </motion.button>

        <span style={{ color: "var(--border)" }}>|</span>

        {/* Plataforma + título */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 scale-[0.6] -mx-2">{plataformaIcon ?? <Radio size={20} style={{ color: COR_LIVE }}/>}</div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide truncate" style={{ color: "var(--text-primary)" }}>
              {live.titulo ?? "LIVE"} — {fmtData(live.data_live ?? "")}
            </p>
          </div>
        </div>

        {/* Etapas compactas */}
        <div className="flex-1 flex items-center justify-center gap-0">
          {ETAPAS_LIVE.map((e, i) => {
            const done    = e.id < etapa
            const current = e.id === etapa
            return (
              <div key={e.id} className="flex items-center">
                {i > 0 && (
                  <motion.div className="h-px w-6"
                    initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    style={{ background: done ? "var(--accent)" : "var(--border)", transformOrigin: "left" }}/>
                )}
                <div className="flex flex-col items-center gap-0.5">
                  <motion.div
                    animate={current ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                    transition={{ repeat: current ? Infinity : 0, duration: 1.8, ease: "easeInOut" }}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                    style={{
                      background: done ? "var(--accent)" : current ? COR_LIVE : "var(--bg-surface)",
                      border: `1.5px solid ${done ? "var(--accent)" : current ? COR_LIVE : "var(--border)"}`,
                      color: done || current ? "#fff" : "var(--text-muted)",
                      boxShadow: current ? `0 0 8px ${COR_LIVE}60` : "none",
                    }}>
                    {done ? <Check size={9}/> : e.id}
                  </motion.div>
                  <p className="text-[7px] font-bold uppercase tracking-wide"
                    style={{ color: done || current ? "var(--text-secondary)" : "var(--text-muted)" }}>
                    {e.label}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Ações no topo */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* Status badge — só exibe Aberta / Encerrada */}
          {live.status !== "disparada" && (
            <motion.span
              animate={{ opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 2 }}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full"
              style={{ background: statusCfg.bg, color: statusCfg.cor }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusCfg.cor }}/>
              {statusCfg.label}
            </motion.span>
          )}

          {live.status !== "encerrada" && (
            <>
              <motion.button onClick={() => setModalCompra(true)}
                whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide"
                style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                <Plus size={14}/> Adicionar Compra
              </motion.button>

              {msgPendentes > 0 && (
                <motion.button onClick={() => setModalDisp(true)}
                  whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                  animate={{ boxShadow: ["0 0 0px #25d36600","0 0 18px #25d36655","0 0 0px #25d36600"] }}
                  transition={{ boxShadow: { repeat: Infinity, duration: 2.2 }, scale: {}, y: {} }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide text-white"
                  style={{ background: "linear-gradient(135deg, #25d366, #128c7e)" }}>
                  <Send size={14}/> Disparar Mensagens
                </motion.button>
              )}

              {live.status === "aberta" && (
                <motion.button onClick={() => setModalAviso(true)}
                  whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                  <Radio size={14}/> Avisar Clientes
                </motion.button>
              )}

              <motion.button onClick={podeEncerrar ? encerrar : undefined} disabled={encerrando}
                whileHover={podeEncerrar ? { scale: 1.03, y: -1 } : {}}
                whileTap={podeEncerrar ? { scale: 0.97 } : { x: [-3,3,-3,0] }}
                transition={podeEncerrar ? {} : { duration: 0.25 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition-all"
                style={{
                  background: podeEncerrar ? "linear-gradient(135deg,#ef4444,#b91c1c)" : "transparent",
                  color: podeEncerrar ? "white" : "var(--text-muted)",
                  border: podeEncerrar ? "none" : "1px solid var(--border)",
                  opacity: encerrando ? 0.6 : 1,
                }}>
                {podeEncerrar ? <CheckCircle2 size={14}/> : <Lock size={14} className="opacity-50"/>}
                {encerrando ? "Encerrando..." : "Encerrar"}
              </motion.button>

              <motion.button onClick={excluir} disabled={excluindo}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition-opacity"
                style={{ color: COR_LIVE, opacity: excluindo ? 0.5 : 1 }}>
                <Trash2 size={13}/> {excluindo ? "Excluindo..." : "Excluir"}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>

      {/* ══ MÉTRICAS ══ */}
      <div className="shrink-0 grid grid-cols-4 gap-4 px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        {[
          { label: "CLIENTES",           val: totalClientes,           cor: "#6366f1", icon: <Users size={15}/> },
          { label: "TOTAL ARRECADADO",   val: fmtBRL(totalArrecadado), cor: "#10b981", icon: <TrendingUp size={15}/> },
          { label: "MENSAGENS ENVIADAS", val: msgEnviadas,             cor: "#3b82f6", icon: <MessageSquare size={15}/> },
          { label: "PENDENTES",          val: msgPendentes,            cor: "#f59e0b", icon: <Clock size={15}/> },
        ].map((m, i) => (
          <motion.div key={m.label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.06, type: "spring", stiffness: 350, damping: 26 }}
            whileHover={{ y: -3, boxShadow: `0 8px 24px ${m.cor}20` }}
            className="rounded-2xl p-5 flex flex-col gap-2 cursor-default"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{m.label}</p>
              <span style={{ color: m.cor }}>{m.icon}</span>
            </div>
            <p className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>{m.val}</p>
          </motion.div>
        ))}
      </div>

      {/* ══ TABELA COMPRAS ══ */}
      <div className="flex-1 flex flex-col overflow-hidden px-6 py-4">

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            COMPRAS DESTA LIVE
          </p>
        </div>

        <div className="flex-1 overflow-y-auto rounded-2xl" style={{ border: "1px solid var(--border)" }}>
          {compras.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center gap-3 py-20">
              <ShoppingBag size={36} className="opacity-20" style={{ color: "var(--text-muted)" }}/>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>NENHUMA COMPRA AINDA</p>
            </motion.div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 z-10" style={{ background: "var(--bg-surface)" }}>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["CLIENTE","SACOLA","ITENS","VALOR","WHATSAPP","STATUS MSG","PAGAMENTO","STATUS","AÇÃO"].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest ${i >= 2 ? "text-center" : "text-left"}`}
                      style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {compras.map((c, idx) => {
                    const sc = STATUS_COMPRA[c.status_compra ?? "cadastrada"] ?? STATUS_COMPRA.cadastrada
                    const progVinculo = c.quantidade_itens ? Math.min(100, ((c.total_produtos_vinculados ?? 0) / c.quantidade_itens) * 100) : 0
                    const podeVincular = (live.status === "disparada" || compras.some(x => x.msg_status === "enviada")) && c.status_compra !== "finalizada"

                    return (
                      <motion.tr key={c.id}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        transition={{ delay: idx * 0.04, type: "spring", stiffness: 300, damping: 28 }}
                        style={{ borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

                        <td className="px-4 py-3.5">
                          <p className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                            {c.nome_cliente}
                          </p>
                        </td>

                        <td className="px-4 py-3.5">
                          <p className="text-xs font-bold uppercase" style={{ color: "var(--text-secondary)" }}>
                            {[c.cor_sacola, c.numero_sacola ? `#${c.numero_sacola}` : ""].filter(Boolean).join(" ") || "—"}
                          </p>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          {(c.status_compra === "aguardando_vinculo" || c.status_compra === "vinculo_parcial" || c.status_compra === "vinculada") ? (
                            <div className="flex flex-col items-center gap-1.5">
                              <p className="text-xs font-black" style={{ color: "var(--text-primary)" }}>
                                {c.total_produtos_vinculados ?? 0}<span style={{ color: "var(--text-muted)" }}>/{c.quantidade_itens ?? 0}</span>
                              </p>
                              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-surface)" }}>
                                <motion.div initial={{ width: 0 }} animate={{ width: `${progVinculo}%` }} transition={{ duration: 0.7 }}
                                  className="h-full rounded-full" style={{ background: progVinculo >= 100 ? "#10b981" : "var(--accent)" }}/>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs font-black" style={{ color: "var(--text-secondary)" }}>{c.quantidade_itens ?? 1}</p>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{fmtBRL(c.valor_total)}</p>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{c.whatsapp || "—"}</p>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full"
                            style={{ background: c.msg_status === "enviada" ? "rgba(59,130,246,0.12)" : "rgba(245,158,11,0.1)", color: c.msg_status === "enviada" ? "#60a5fa" : "#f59e0b" }}>
                            {c.msg_status === "enviada" ? <MessageSquare size={9}/> : <Clock size={9}/>}
                            {c.msg_status === "enviada" ? "ENVIADA" : "PENDENTE"}
                          </span>
                        </td>

                        {/* PAGAMENTO */}
                        <td className="px-4 py-3.5 text-center">
                          {c.pagamento_status === "PAGO" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full"
                              style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                              <CheckCircle2 size={9}/> PAGO
                            </span>
                          ) : (c.link_pagamento || c.pagamento_status === "EM_ABERTO" || c.pagamento_status == null) && c.valor_total > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full"
                              style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                              <Clock size={9}/> EM ABERTO
                            </span>
                          ) : (
                            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full"
                            style={{ background: sc.bg, color: sc.cor }}>
                            {sc.icon} {sc.label.toUpperCase()}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {live.status !== "encerrada" && c.status_compra !== "finalizada" && (
                              <motion.button onClick={() => setEditCompra(c)}
                                whileHover={{ scale: 1.06, y: -1 }} whileTap={{ scale: 0.94 }}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg"
                                style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}>
                                <Pencil size={10}/> EDITAR
                              </motion.button>
                            )}
                            {live.status !== "encerrada" && podeVincular && (
                              <motion.button onClick={() => setModalVinculo(c)}
                                whileHover={{ scale: 1.06, y: -1 }} whileTap={{ scale: 0.94 }}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg"
                                style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                                <Link2 size={10}/> VINCULAR
                              </motion.button>
                            )}
                            {c.status_compra === "finalizada" && (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg"
                                style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                                <CheckCircle2 size={10}/> OK
                              </span>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>

        <AnimatePresence>
          {erroEnc && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-2 px-4 py-2.5 rounded-xl flex items-center gap-2"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle size={13} style={{ color: "#f87171" }}/>
              <p className="text-xs font-semibold uppercase" style={{ color: "#f87171" }}>{erroEnc}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modais */}
      <AnimatePresence>
        {modalCompra   && <WizardCompra  liveId={liveId} onClose={() => setModalCompra(false)}  onSalvo={() => { refetch(); qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] }) }}/>}
        {modalDisparar && <ModalDisparar liveId={liveId} liveTitulo={live.titulo ?? ""} liveData={live.data_live ?? ""} compras={compras} onClose={() => setModalDisp(false)} onSuccess={() => { setModalDisp(false); qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] }); setTimeout(() => refetch(), 800) }}/>}

      {modalAviso && <ModalAvisoLive liveId={liveId} tipo={live.tipo ?? "novidades"} linkAtual={live.link_live ?? ""} onClose={() => setModalAviso(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] }); refetch() }}/>}
        {modalVinculo  && <ModalVinculo  liveId={liveId} compra={modalVinculo} onClose={() => setModalVinculo(null)} onAtualizado={() => { refetch(); qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] }) }}/>}
        {editCompra    && <ModalEditarCompra liveId={liveId} compra={editCompra} onClose={() => setEditCompra(null)} onSalvo={() => { setEditCompra(null); refetch() }}/>}
      </AnimatePresence>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL — Lista de Lives
// ══════════════════════════════════════════════════════════
export default function LivePage() {
  const [wizard, setWizard]       = useState(false)
  const [liveAberta, setAberta]   = useState<number | null>(null)
  const [statusFiltro, setStatus] = useState("")

  const { data, isLoading } = useQuery<{ data: Live[]; total: number }>({
    queryKey: ["lives", statusFiltro],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: "50", ...(statusFiltro && { status: statusFiltro }) }).toString()
      return apiGet(`/live?${qs}`)
    },
    staleTime: 30_000,
  })

  const lives = data?.data ?? []

  if (liveAberta !== null) {
    return <TelaLive liveId={liveAberta} onVoltar={() => setAberta(null)}/>
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>Live</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{data?.total ?? 0} lives</p>
        </div>
        <motion.button onClick={() => setWizard(true)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white shadow-lg"
          style={{ background: COR_LIVE }}>
          <Radio size={15}/> Nova Live
        </motion.button>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl px-4 py-3 flex gap-1.5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {["","aberta","encerrada","disparada"].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all"
            style={{
              background: statusFiltro === s ? "var(--accent)" : "transparent",
              color: statusFiltro === s ? "#fff" : "var(--text-secondary)",
            }}>
            {s || "Todas"}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["","Título","Data","Plataforma","Status","Criada em"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-wider ${i >= 2 ? "text-center" : "text-left"}`}
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "var(--accent)" }}/>
                </td></tr>
              ) : lives.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <Radio size={32} className="mx-auto mb-2 opacity-30" style={{ color: "var(--text-muted)" }}/>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhuma live encontrada.</p>
                </td></tr>
              ) : lives.map(l => {
                const plat = PLATAFORMAS.find(p => p.value === l.plataforma)
                return (
                  <tr key={l.id} className="transition-colors cursor-pointer" style={{ borderBottom: "1px solid var(--border)" }}
                    onClick={() => setAberta(l.id)}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent" }}>
                    <td className="px-4 py-3">
                      <ChevronRight size={15} style={{ color: "var(--text-muted)" }}/>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>
                      {l.titulo || "SEM TÍTULO"}
                    </td>
                    <td className="px-4 py-3 text-sm text-center" style={{ color: "var(--text-secondary)" }}>
                      {fmtData(l.data_live ?? "")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {plat ? (
                        <span className="scale-75 inline-block">{plat.icon}</span>
                      ) : (
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full uppercase",
                        STATUS_COLORS[l.status ?? "aberta"] ?? "bg-slate-500/15 text-slate-400")}>
                        {l.status ?? "aberta"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center" style={{ color: "var(--text-muted)" }}>
                      {fmtData((l as Live & { created_at?: string }).created_at ?? l.data_live ?? "")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {wizard && <WizardLive onClose={() => setWizard(false)} onSalvo={id => { setWizard(false); setAberta(id) }}/>}
      </AnimatePresence>
    </div>
  )
}
