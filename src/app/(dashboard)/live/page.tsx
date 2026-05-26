"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import {
  Plus, Loader2, X, ChevronLeft, ArrowRight, Radio, Send,
  Check, Search, ShoppingBag, User, ChevronDown, Package,
  AlertTriangle, CheckCircle2, Link2, Trash2, ChevronRight,
  Zap, Clock, Circle, Ban, RefreshCw, TrendingUp, Users,
  MessageSquare, PackageCheck, Lock,
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

interface LiveForm { data_live: string; titulo: string; plataforma: string }
interface CompraForm {
  cliente_id: number | null; nome_cliente: string; whatsapp: string
  cor_sacola: string; numero_sacola: string
  quantidade_itens: string; quantidade_volumes: string
  valor_total: string; desconto: string; observacao: string
}

const hoje = new Date().toISOString().split("T")[0]
const EMPTY_LIVE: LiveForm = { data_live: hoje, titulo: "", plataforma: "instagram" }
const EMPTY_COMPRA: CompraForm = {
  cliente_id: null, nome_cliente: "", whatsapp: "",
  cor_sacola: "", numero_sacola: "",
  quantidade_itens: "1", quantidade_volumes: "1",
  valor_total: "", desconto: "", observacao: "",
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
  if (live.status === "encerrada") return 6
  const compras = live.compras ?? []
  if (!compras.length) return 1
  const disparada = live.status === "disparada" || compras.some(c => c.msg_status === "enviada")
  if (!disparada) return 2
  const todasVinculadas = compras.every(c => c.status_compra === "vinculada" || c.status_compra === "finalizada")
  if (!todasVinculadas) return 3
  const todasFinalizadas = compras.every(c => c.status_compra === "finalizada")
  if (!todasFinalizadas) return 4
  return 5
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
      const nova = await apiPost<{ id: number }>("/live", { data_live: form.data_live, titulo: form.titulo || null, plataforma: form.plataforma || null })
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
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Identifica o conteúdo nos relatórios.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  {[
                    { value: "PROMOCIONAL", emoji: "🏷️", desc: "Ofertas, descontos e promoções" },
                    { value: "NOVIDADES",   emoji: "✨", desc: "Lançamentos e novas peças" },
                  ].map(op => (
                    <motion.button key={op.value} onClick={() => { set("titulo", op.value); advance() }}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      className="flex-1 p-6 rounded-2xl text-left border-2"
                      style={{ background: form.titulo === op.value ? "var(--accent-bg)" : "var(--bg-surface)", borderColor: form.titulo === op.value ? COR_LIVE : "var(--border)", color: "var(--text-primary)" }}>
                      <div className="text-4xl mb-3">{op.emoji}</div>
                      <p className="font-bold text-base uppercase">{op.value}</p>
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
        quantidade_volumes: parseInt(form.quantidade_volumes) || 1,
        valor_total:       parseFloat(form.valor_total.replace(",", ".")) || 0,
        desconto:          parseFloat(form.desconto.replace(",", ".")) || 0,
        observacao:        form.observacao || undefined,
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

              {/* Step 3 — Qtd e Volumes */}
              {step === 3 && <>
                <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Quantidades</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Itens e volumes separados para entrega.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>QTD DE ITENS</p>
                    <input ref={inputRef} type="number" min="1" value={form.quantidade_itens}
                      onChange={e => set("quantidade_itens", e.target.value)}
                      className={iBase} style={iSt}/>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>QTD DE VOLUMES</p>
                    <input type="number" min="1" value={form.quantidade_volumes}
                      onChange={e => set("quantidade_volumes", e.target.value)}
                      className={iBase} style={iSt}/>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>OBSERVAÇÃO (opcional)</p>
                  <textarea value={form.observacao} onChange={e => set("observacao", e.target.value)}
                    placeholder="Alguma observação sobre esta compra..."
                    rows={2} className="w-full px-4 py-3 text-base rounded-2xl outline-none transition-all border-2 resize-none"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
                </div>
              </>}

              {/* Step 4 — Valor */}
              {step === 4 && <>
                <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Valor da compra</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Valor total cobrado nesta sacola.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>VALOR TOTAL</p>
                    <input ref={inputRef} value={form.valor_total} onChange={e => set("valor_total", e.target.value)}
                      placeholder="0,00" className={iBase} style={iSt}/>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>DESCONTO</p>
                    <input value={form.desconto} onChange={e => set("desconto", e.target.value)}
                      placeholder="0,00" className={iBase} style={iSt}/>
                  </div>
                </div>

                {/* Resumo da compra */}
                <div className="mt-6 rounded-2xl p-4 space-y-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Resumo</p>
                  {[
                    { l: "Cliente",   v: form.nome_cliente || cliBusca || "—" },
                    { l: "Sacola",    v: [form.cor_sacola, form.numero_sacola ? `#${form.numero_sacola}` : ""].filter(Boolean).join(" ") || "—" },
                    { l: "Itens",     v: `${form.quantidade_itens} item(ns) · ${form.quantidade_volumes} volume(s)` },
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
  const [prodRes, setProdRes] = useState<Array<{ id: number; nome: string; preco?: number; estoque?: number }>>([])
  const [form,    setForm]    = useState({ produto_id: 0, nome_produto: "", quantidade: 1, preco_original: 0, preco_live: 0 })
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
    setForm({ produto_id: p.id, nome_produto: p.nome, quantidade: 1, preco_original: p.preco ?? 0, preco_live: p.preco ?? 0 })
    setBusca(p.nome); setProdRes([])
  }

  async function vincular() {
    if (!form.nome_produto) { setErro("Selecione um produto"); return }
    setSaving(true); setErro("")
    try {
      await apiPost(`/live/${liveId}/compras/${compra.id}/produtos`, {
        produto_id: form.produto_id || undefined,
        nome_produto: form.nome_produto,
        quantidade: form.quantidade,
        preco_original: form.preco_original,
        preco_live: form.preco_live,
      })
      setBusca(""); setProdRes([])
      setForm({ produto_id: 0, nome_produto: "", quantidade: 1, preco_original: 0, preco_live: 0 })
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
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-start justify-between p-6 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <p className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{compra.nome_cliente}</p>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {[compra.cor_sacola, compra.numero_sacola ? `#${compra.numero_sacola}` : ""].filter(Boolean).join(" ") || "Sem sacola"} · {fmtBRL(compra.valor_total)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}><X size={18}/></button>
        </div>

        {/* Progresso */}
        <div className="px-6 pt-4 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              {totalVinculado} de {qtdEsperada} itens vinculados
            </p>
            <p className="text-xs font-bold" style={{ color: progresso >= 100 ? "#10b981" : "var(--accent)" }}>
              {Math.round(progresso)}%
            </p>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-surface)" }}>
            <motion.div animate={{ width: `${progresso}%` }} transition={{ duration: 0.4, ease: "easeOut" }}
              className="h-full rounded-full" style={{ background: progresso >= 100 ? "#10b981" : "var(--accent)" }}/>
          </div>
        </div>

        {/* Produtos vinculados */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          <AnimatePresence>
            {(produtos ?? []).map(p => (
              <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: p.estoque_baixado ? "rgba(16,185,129,0.12)" : "var(--accent-bg)" }}>
                  {p.estoque_baixado ? <CheckCircle2 size={14} style={{ color: "#10b981" }}/> : <Package size={14} style={{ color: "var(--accent)" }}/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.nome_produto}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {p.quantidade}x · Live: {fmtBRL(p.preco_live)}
                    {p.preco_original !== p.preco_live && <span style={{ color: "#10b981" }}> ({fmtBRL(p.preco_original - p.preco_live)} off)</span>}
                  </p>
                </div>
                {p.estoque_baixado && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>Estoque ✓</span>}
                <button onClick={() => remover(p.id)} className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }}>
                  <Trash2 size={13}/>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {(produtos ?? []).length === 0 && (
            <div className="py-8 text-center">
              <Package size={32} className="mx-auto mb-2 opacity-30" style={{ color: "var(--text-muted)" }}/>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhum produto vinculado ainda</p>
            </div>
          )}
        </div>

        {/* Formulário vincular */}
        <div className="px-6 pb-4 shrink-0 space-y-3" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Vincular produto</p>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}/>
            <input value={busca} onChange={e => buscarProdutos(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full pl-9 pr-4 py-3 text-sm rounded-xl outline-none border"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
            {prodRes.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-lg z-10 overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {prodRes.map(p => (
                  <button key={p.id} onClick={() => selecionarProd(p)}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors">
                    <span style={{ color: "var(--text-primary)" }}>{p.nome}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtBRL(p.preco ?? 0)} · est:{p.estoque ?? 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {form.nome_produto && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-muted)" }}>Qtd</p>
                <input type="number" min="1" value={form.quantidade}
                  onChange={e => setForm(f => ({ ...f, quantidade: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 text-sm rounded-xl outline-none border"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-muted)" }}>Preço original</p>
                <input type="number" step="0.01" value={form.preco_original}
                  onChange={e => setForm(f => ({ ...f, preco_original: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 text-sm rounded-xl outline-none border"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-muted)" }}>Preço live</p>
                <input type="number" step="0.01" value={form.preco_live}
                  onChange={e => setForm(f => ({ ...f, preco_live: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 text-sm rounded-xl outline-none border"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {erro && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-xs flex items-center gap-1.5" style={{ color: "#f87171" }}>
              <AlertTriangle size={12}/> {erro}
            </motion.p>}
          </AnimatePresence>

          <div className="flex gap-2">
            {form.nome_produto && (
              <motion.button onClick={vincular} disabled={saving} whileTap={{ scale: 0.97 }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--accent)" }}>
                {saving ? <Loader2 size={14} className="animate-spin"/> : <Link2 size={14}/>}
                Vincular
              </motion.button>
            )}
            {podeFinalizar && (
              <motion.button onClick={finalizar} disabled={finalizando} whileTap={{ scale: 0.97 }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "#10b981" }}>
                {finalizando ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
                Finalizar Compra
              </motion.button>
            )}
          </div>
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
  const [resultado, setResultado] = useState<{ enviadas: number; erros: number; resultados: Array<{ id: number; cliente: string; numero: string; status: string }> } | null>(null)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape" && fase !== "disparando") onClose() }
    document.addEventListener("keydown", fn); return () => document.removeEventListener("keydown", fn)
  }, [onClose, fase])

  const pendentes = compras.filter(c => !c.msg_status || c.msg_status === "pendente" || c.msg_status === "erro")
  const ex = pendentes[0]

  function fmtVal(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) }
  function fmtD(d?: string) { return d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR") }

  function msgPreview(c: typeof ex) {
    if (!c) return ""
    const linkPagamento = c.link_pagamento || ""
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

O pagamento deve ser realizado até segunda-feira às 23:59, via PIX ou Cartão, para manter suas peças reservadas com carinho. 💖

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
      const res = await apiPost<{ enviadas: number; erros: number; resultados: Array<{ id: number; cliente: string; numero: string; status: string }> }>(`/live/${liveId}/disparar`, {})
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
      className="fixed inset-0 z-[70] flex flex-col" style={{ background: "var(--bg-base)" }}>
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
              <div key={r.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>{r.cliente}</span>
                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                  r.status === "enviada" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
                  {r.status}
                </span>
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
// TELA DETALHE DA LIVE
// ══════════════════════════════════════════════════════════
function TelaLive({ liveId, onVoltar }: { liveId: number; onVoltar: () => void }) {
  const qc = useQueryClient()
  const [modalCompra, setModalCompra]   = useState(false)
  const [modalDisparar, setModalDisp]   = useState(false)
  const [modalVinculo, setModalVinculo] = useState<Compra | null>(null)
  const [erroEnc, setErroEnc] = useState("")
  const [encerrando, setEnc]  = useState(false)
  const [excluindo, setExc]   = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["live-detalhe", liveId],
    queryFn: () => apiGet<LiveDetalhe>(`/live/${liveId}`),
    refetchInterval: 30_000,
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
          {/* Status badge */}
          <motion.span
            animate={{ opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 2 }}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full"
            style={{ background: statusCfg.bg, color: statusCfg.cor }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusCfg.cor }}/>
            {statusCfg.label}
          </motion.span>

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
                  {["CLIENTE","SACOLA","ITENS","VALOR","WHATSAPP","STATUS MSG","STATUS","AÇÃO"].map((h, i) => (
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

                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full"
                            style={{ background: sc.bg, color: sc.cor }}>
                            {sc.icon} {sc.label.toUpperCase()}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-center">
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
                          {live.status !== "encerrada" && !podeVincular && c.status_compra !== "finalizada" && (
                            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>—</span>
                          )}
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
        {modalDisparar && <ModalDisparar liveId={liveId} liveTitulo={live.titulo ?? ""} liveData={live.data_live ?? ""} compras={compras} onClose={() => setModalDisp(false)} onSuccess={() => { setModalDisp(false); refetch() }}/>}
        {modalVinculo  && <ModalVinculo  liveId={liveId} compra={modalVinculo} onClose={() => setModalVinculo(null)} onAtualizado={() => { refetch(); qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] }) }}/>}
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
          <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>Live Commerce</h2>
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
