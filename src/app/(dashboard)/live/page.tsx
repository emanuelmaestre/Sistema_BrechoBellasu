"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import {
  Plus, Loader2, X, ChevronLeft, ArrowRight, Radio, Send,
  ChevronRight, Check, Search, ShoppingBag, User, ChevronDown,
} from "lucide-react"
import { apiGet, apiPost, apiPatch, apiDelete } from "@/services/api"
import { useDropdownKeyNav } from "@/hooks/useKeyNav"
import DatePicker from "@/components/DatePicker"
import { fmtBRL, fmtData, cn } from "@/lib/utils"
import type { Live } from "@/types"

// ─── Tipos ────────────────────────────────────────────────
type LiveDetalhe = Live & {
  compras: Array<{
    id: number; nome_cliente: string; whatsapp?: string
    numero_sacola?: string; cor_sacola?: string
    quantidade_itens?: number; valor_total: number; desconto?: number
    msg_status?: string; data_compra?: string; link_pagamento?: string
  }>
}

interface Cliente {
  id: number; nome: string; cpf_cnpj?: string | null; celular?: string | null
}

interface ProdutoItem {
  produto_id?: number; nome_produto: string; quantidade: number; preco_unitario: number
}

const STATUS_COLORS: Record<string, string> = {
  aberta:    "bg-emerald-500/10 text-emerald-400",
  encerrada: "bg-slate-500/15 text-slate-400",
  disparada: "bg-blue-500/10 text-blue-400",
}

interface LiveForm {
  data_live: string; titulo: string; plataforma: string
}

interface CompraForm {
  cliente_id: number | null; nome_cliente: string; whatsapp: string
  cor_sacola: string; numero_sacola: string
  quantidade_itens: string; valor_total: string; desconto: string
}

const hoje = new Date().toISOString().split("T")[0]
const EMPTY_LIVE: LiveForm = { data_live: hoje, titulo: "", plataforma: "instagram" }
const EMPTY_COMPRA: CompraForm = {
  cliente_id: null, nome_cliente: "", whatsapp: "",
  cor_sacola: "", numero_sacola: "",
  quantidade_itens: "1", valor_total: "", desconto: "",
}

const CORES_SACOLA = ["Amarela","Azul","Bege","Branca","Cinza","Laranja","Lilás","Marrom","Preta","Rosa","Roxa","Verde","Vermelha"]
const COR_LIVE = "#e11d48"

// ─── Animação ─────────────────────────────────────────────
const variants = {
  enter:  (d: number) => ({ x: d > 0 ?  60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: d > 0 ? -60 :  60, opacity: 0 }),
}

// ─── Ícones de plataforma ──────────────────────────────────
function IconInstagram() {
  return (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none">
      <defs>
        <linearGradient id="ig1" x1="0" y1="48" x2="48" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f09433"/>
          <stop offset="25%" stopColor="#e6683c"/>
          <stop offset="50%" stopColor="#dc2743"/>
          <stop offset="75%" stopColor="#cc2366"/>
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

// ─── Wizard Nova Live ──────────────────────────────────────
function WizardLive({ onClose, onSalvo }: { onClose: () => void; onSalvo: (id: number) => void }) {
  const qc = useQueryClient()
  const [step, setStep]     = useState(1)
  const [dir, setDir]       = useState(1)
  const [form, setForm]     = useState<LiveForm>(EMPTY_LIVE)
  const [erro, setErro]     = useState("")
  const [saving, setSaving] = useState(false)
  const [platIdx, setPlatIdx] = useState(0)   // índice focado no step 2
  const inputRef = useRef<HTMLInputElement>(null)
  const TOTAL = 3

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 280)
    return () => clearTimeout(t)
  }, [step])

  // ao entrar no step 2, sincroniza o índice com a plataforma já selecionada
  useEffect(() => {
    if (step === 2) {
      const idx = PLATAFORMAS.findIndex(p => p.value === form.plataforma)
      setPlatIdx(idx >= 0 ? idx : 0)
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  function set(k: keyof LiveForm, v: string) { setForm(f => ({ ...f, [k]: v })); setErro("") }
  function go(next: number) { setDir(next > step ? 1 : -1); setStep(next); setErro("") }

  function advance() {
    if (step === 1 && !form.data_live) { setErro("Informe a data da live"); return }
    if (step < TOTAL) go(step + 1)
    else handleSalvar()
  }

  async function handleSalvar() {
    setSaving(true); setErro("")
    try {
      const novaLive = await apiPost<{ id: number }>("/live", {
        data_live:  form.data_live,
        titulo:     form.titulo || null,
        plataforma: form.plataforma || null,
      })
      qc.invalidateQueries({ queryKey: ["lives"] })
      onSalvo(novaLive.id)
    } catch { setErro("Erro ao criar live. Tente novamente.") }
    finally { setSaving(false) }
  }

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (step === 2) {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setPlatIdx(i => (i - 1 + PLATAFORMAS.length) % PLATAFORMAS.length)
        return
      }
      if (e.key === "ArrowRight") {
        e.preventDefault()
        setPlatIdx(i => (i + 1) % PLATAFORMAS.length)
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        set("plataforma", PLATAFORMAS[platIdx].value)
        go(3)
        return
      }
    }
    if (e.key === "Enter" && step < TOTAL) { e.preventDefault(); advance() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, platIdx])

  const iBase = "w-full px-5 py-4 text-lg rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>Brechó Bellasu</span>
          <span style={{ color: "var(--border-hover)" }}>|</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Nova Live</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>{step} / {TOTAL}</span>
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors" style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
            <X size={15} /> Cancelar
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-hidden relative" onKeyDown={handleKey}>
        <AnimatePresence custom={dir} mode="wait">
          {(
            <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="absolute inset-0 flex flex-col items-center justify-center px-6">
              <div className="w-full max-w-xl">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base font-bold" style={{ color: COR_LIVE }}>{step}</span>
                  <ArrowRight size={14} style={{ color: COR_LIVE }} />
                </div>

                {/* Step 1 — Data */}
                {step === 1 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Data da Live</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Data que ocorreu a Live 📅.</p>
                  <DatePicker value={form.data_live} onChange={v => set("data_live", v)}
                    inputClassName={iBase} />
                </>}

                {/* Step 2 — Plataforma */}
                {step === 2 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Qual a plataforma?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Onde a live foi transmitida.</p>
                  <div className="grid grid-cols-3 gap-3">
                    {PLATAFORMAS.map((op, idx) => {
                      const isSelected = form.plataforma === op.value
                      const isFocused  = platIdx === idx
                      return (
                        <button key={op.value}
                          onClick={() => { set("plataforma", op.value); go(3) }}
                          onMouseEnter={() => setPlatIdx(idx)}
                          className="p-5 rounded-2xl text-center transition-all border-2 flex flex-col items-center gap-3 outline-none"
                          style={{
                            background:   isSelected || isFocused ? "var(--accent-bg)" : "var(--bg-surface)",
                            borderColor:  isSelected || isFocused ? "var(--accent)"    : "var(--border)",
                            color: "var(--text-primary)",
                            boxShadow: isFocused && !isSelected ? "0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)" : undefined,
                          }}>
                          {op.icon}
                          <p className="font-semibold text-sm">{op.label}</p>
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-4 text-xs text-center" style={{ color: "var(--text-muted)" }}>
                    Use <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>←</kbd>
                    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>→</kbd>
                    para navegar · <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Enter</kbd>
                    para selecionar
                  </p>
                </>}

                {/* Step 3 — Categoria */}
                {step === 3 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Categoria da live?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Identifica o tipo de conteúdo desta live nos relatórios.</p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    {[
                      { value: "PROMOCIONAL", emoji: "🏷️", desc: "Ofertas, descontos e promoções" },
                      { value: "NOVIDADES",   emoji: "✨", desc: "Lançamentos e novas peças" },
                    ].map(op => (
                      <motion.button key={op.value}
                        onClick={() => { set("titulo", op.value); advance() }}
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        className="flex-1 p-6 rounded-2xl text-left transition-all border-2"
                        style={{
                          background: form.titulo === op.value ? "var(--accent-bg)" : "var(--bg-surface)",
                          borderColor: form.titulo === op.value ? COR_LIVE : "var(--border)",
                          color: "var(--text-primary)",
                        }}>
                        <div className="text-4xl mb-3">{op.emoji}</div>
                        <p className="font-bold text-base uppercase">{op.value}</p>
                        <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>{op.desc}</p>
                      </motion.button>
                    ))}
                  </div>
                </>}

                <AnimatePresence>
                  {erro && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-2 text-sm" style={{ color: "#f87171" }}>{erro}</motion.p>}
                </AnimatePresence>

                {step !== 2 && (
                  <div className="flex items-center gap-4 mt-8">
                    <button onClick={advance} disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg transition-opacity disabled:opacity-60"
                      style={{ background: COR_LIVE }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                      {step === TOTAL
                        ? (saving ? <><Loader2 size={14} className="animate-spin"/>Criando...</> : <>🔴 Criar Live</>)
                        : <>Continuar <ArrowRight size={15}/></>}
                    </button>
                    {step > 1 && (
                      <button onClick={() => go(step + 1)}
                        className="text-sm font-medium transition-colors" style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                        Pular →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

          )}
        </AnimatePresence>
      </div>

      {step > 1 && step !== 2 && (
        <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => go(step - 1)}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)" }}>
            <ChevronLeft size={15} /> Voltar
          </button>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Pressione <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Enter</kbd> para avançar
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Wizard Adicionar Compra ──────────────────────────────
function WizardCompra({ liveId, liveData, onClose, onSalvo }: { liveId: number; liveData?: string; onClose: () => void; onSalvo: () => void }) {
  const [step, setStep]     = useState(1)
  const [dir,  setDir]      = useState(1)
  const [form, setForm]     = useState<CompraForm>(EMPTY_COMPRA)
  const [erro, setErro]     = useState("")
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const TOTAL = 5

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  // busca de cliente
  const [cliBusca, setCliBusca]   = useState("")
  const [cliRes,   setCliRes]     = useState<Cliente[]>([])
  const [cliSel,   setCliSel]     = useState<Cliente | null>(null)

  // cor da sacola — índice para navegação por teclado
  const [corIdx,   setCorIdx]     = useState(0)

  // produtos
  const [prodBusca, setProdBusca] = useState("")
  const [prodRes,   setProdRes]   = useState<Array<{ id: number; nome: string; preco?: number; estoque?: number }>>([])
  const [itens,     setItens]     = useState<ProdutoItem[]>([])

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 280)
    return () => clearTimeout(t)
  }, [step])

  // Pré-seleciona primeira cor da sacola ao entrar no step 2
  useEffect(() => {
    if (step === 2) {
      const idx = form.cor_sacola ? CORES_SACOLA.indexOf(form.cor_sacola) : 0
      const safeIdx = idx >= 0 ? idx : 0
      setCorIdx(safeIdx)
      setForm(f => ({ ...f, cor_sacola: CORES_SACOLA[safeIdx] }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const buscarClientes = useCallback(async (val: string) => {
    setCliBusca(val); setCliSel(null)
    if (val.length < 2) { setCliRes([]); return }
    try {
      const res = await apiGet<{ data: Cliente[] }>(`/clientes?busca=${encodeURIComponent(val)}&limit=8`)
      setCliRes(res.data ?? [])
    } catch { setCliRes([]) }
  }, [])

  function selecionarCliente(c: Cliente) {
    setCliSel(c); setCliBusca(c.nome); setCliRes([])
    setForm(f => ({ ...f, cliente_id: c.id, nome_cliente: c.nome, whatsapp: c.celular ?? "" }))
  }

  const { hi: cliHi, onKeyDown: cliKeyDown, reset: resetCliHi } = useDropdownKeyNav(cliRes, selecionarCliente)

  const buscarProdutos = useCallback(async (val: string) => {
    setProdBusca(val)
    if (val.length < 2) { setProdRes([]); return }
    try {
      const res = await apiGet<{ data: Array<{ id: number; nome: string; preco?: number; estoque?: number }> }>(`/produtos?busca=${encodeURIComponent(val)}&limit=8`)
      setProdRes(res.data ?? [])
    } catch { setProdRes([]) }
  }, [])

  function adicionarItem(p: { id?: number; nome: string; preco?: number }) {
    const nomeUp = p.nome.toUpperCase()
    const exists = itens.findIndex(i => i.produto_id === p.id && p.id)
    if (exists >= 0) {
      setItens(prev => prev.map((it, idx) => idx === exists ? { ...it, quantidade: it.quantidade + 1 } : it))
    } else {
      setItens(prev => [...prev, { produto_id: p.id, nome_produto: nomeUp, quantidade: 1, preco_unitario: p.preco ?? 0 }])
    }
    setProdBusca(""); setProdRes([])
  }

  function set(k: keyof CompraForm, v: string) { setForm(f => ({ ...f, [k]: v })); setErro("") }
  function go(next: number) { setDir(next > step ? 1 : -1); setStep(next); setErro("") }

  function advance() {
    if (step === 1) {
      const nome = form.nome_cliente.trim() || cliBusca.trim()
      if (!nome) { setErro("Nome do cliente é obrigatório"); return }
      if (!form.nome_cliente.trim()) set("nome_cliente", cliBusca.trim())
    }
    // auto-preenche desconto com "0,00" se vazio ao sair do step de itens
    if (step === 3 && !form.desconto.trim()) setForm(f => ({ ...f, desconto: "0,00" }))
    if (step < TOTAL) go(step + 1)
  }

  async function salvar() {
    setSaving(true); setErro("")
    try {
      await apiPost(`/live/${liveId}/compras`, {
        cliente_id:       form.cliente_id ?? undefined,
        nome_cliente:     form.nome_cliente,
        whatsapp:         form.whatsapp || undefined,
        cor_sacola:       form.cor_sacola || undefined,
        numero_sacola:    form.numero_sacola || undefined,
        quantidade_itens: parseInt(form.quantidade_itens) || 1,
        valor_total:      parseFloat(form.valor_total.replace(",", ".")) || 0,
        desconto:         parseFloat(form.desconto.replace(",", ".")) || 0,
        itens: itens.length > 0 ? itens : undefined,
      })
      onSalvo(); onClose()
    } catch { setErro("Erro ao registrar compra.") }
    finally { setSaving(false) }
  }

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    // No step 1: ↑↓ e Enter são tratados pelo cliKeyDown (dropdown)
    if (step === 1) {
      if (e.key === "Enter" && cliRes.length === 0) { e.preventDefault(); advance() }
      return
    }
    // Step 2: ↑↓ navegam na cor, Enter avança
    if (step === 2) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setCorIdx(i => {
          const next = (i + 1) % CORES_SACOLA.length
          setForm(f => ({ ...f, cor_sacola: CORES_SACOLA[next] }))
          return next
        })
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setCorIdx(i => {
          const prev = (i - 1 + CORES_SACOLA.length) % CORES_SACOLA.length
          setForm(f => ({ ...f, cor_sacola: CORES_SACOLA[prev] }))
          return prev
        })
        return
      }
      if (e.key === "Enter") { e.preventDefault(); advance(); return }
    }
    if (e.key === "Enter" && step < TOTAL) { e.preventDefault(); advance() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, cliRes, corIdx])

  const iBase = "w-full px-5 py-4 text-lg rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }
  const iSmBase = "w-full px-4 py-3 text-base rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"

  const totalItens = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--bg-base)" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: COR_LIVE }}>Brechó Bellasu</span>
          <span style={{ color: "var(--border-hover)" }}>|</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Adicionar Compra</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>{step} / {TOTAL}</span>
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors" style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
            <X size={15} /> Cancelar
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-hidden relative" onKeyDown={handleKey}>
        <AnimatePresence custom={dir} mode="wait">
          {step < TOTAL ? (
            <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="absolute inset-0 flex flex-col items-center justify-center px-6 overflow-y-auto py-10">
              <div className="w-full max-w-xl">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base font-bold" style={{ color: COR_LIVE }}>{step}</span>
                  <ArrowRight size={14} style={{ color: COR_LIVE }} />
                </div>

                {/* ── Step 1: Cliente ── */}
                {step === 1 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Qual cliente fez a compra?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Busque pelo nome ou WhatsApp cadastrado.</p>

                  <div className="relative mb-2">
                    <input ref={inputRef} value={cliBusca}
                      onChange={e => { buscarClientes(e.target.value); resetCliHi() }}
                      onKeyDown={cliKeyDown}
                      placeholder="DIGITE O NOME OU TELEFONE..."
                      className="w-full px-4 py-4 text-base rounded-xl outline-none transition-all border"
                      style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                      autoComplete="off" />
                  </div>

                  {cliRes.length > 0 && (
                    <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                      {cliRes.map((c, idx) => (
                        <button key={c.id}
                          onMouseDown={() => selecionarCliente(c)}
                          className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                          style={{
                            borderBottom: "1px solid var(--border)",
                            background: cliHi === idx ? "var(--accent-bg)" : "transparent",
                          }}
                          onMouseEnter={e => { if (cliHi !== idx) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                          onMouseLeave={e => { if (cliHi !== idx) (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                            style={{ background: cliHi === idx ? "rgba(37,99,235,0.2)" : "#dbeafe", color: "#2563eb" }}>
                            {c.nome[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium uppercase" style={{ color: cliHi === idx ? "var(--accent)" : "var(--text-primary)" }}>{c.nome}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.celular ?? c.cpf_cnpj ?? ""}</p>
                          </div>
                          {cliSel?.id === c.id && <Check size={14} className="ml-auto shrink-0" style={{ color: "#2563eb" }}/>}
                          {cliHi === idx && cliSel?.id !== c.id && (
                            <kbd className="ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded font-mono"
                              style={{ background: "var(--accent)", color: "#fff" }}>↵</kbd>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {cliSel ? (
                    <div className="mt-2 px-4 py-2 rounded-xl flex items-center gap-2"
                      style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                      <Check size={13} style={{ color: "#16a34a" }}/>
                      <p className="text-sm font-medium" style={{ color: "#15803d" }}>{cliSel.nome} selecionado</p>
                    </div>
                  ) : cliRes.length > 0 && (
                    <p className="mt-2 text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>
                      Use{" "}
                      <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>↑</kbd>
                      <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>↓</kbd>
                      para navegar ·
                      <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>↵ Enter</kbd>
                      para selecionar
                    </p>
                  )}
                </>}

                {/* ── Step 2: Sacola ── */}
                {step === 2 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Sacola</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Informe a cor e o número da sacola separada.</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>COR DA SACOLA</p>
                      {/* Custom color picker — navegável por ↑↓ e confirma com Enter */}
                      <div className="relative">
                        <div className="w-full px-4 py-4 text-base rounded-2xl border-2 font-medium flex items-center justify-between"
                          style={{
                            background: "var(--bg-surface)",
                            borderColor: "var(--accent)",
                            color: "var(--text-primary)",
                          }}>
                          <span>{form.cor_sacola?.toUpperCase() || "AMARELA"}</span>
                          <div className="flex flex-col items-center gap-0.5 opacity-40">
                            <ChevronDown size={12} style={{ transform: "rotate(180deg)" }}/>
                            <ChevronDown size={12}/>
                          </div>
                        </div>
                        {/* Mini hint */}
                        <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                          ↑↓ para navegar · Enter para avançar
                        </p>
                        {/* Scroll list de cores */}
                        <div className="mt-2 rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                          {CORES_SACOLA.map((cor, i) => (
                            <button key={cor} type="button"
                              onClick={() => { setCorIdx(i); setForm(f => ({ ...f, cor_sacola: cor })) }}
                              className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors"
                              style={{
                                background: corIdx === i ? "var(--accent-bg)" : "transparent",
                                color: corIdx === i ? "var(--accent)" : "var(--text-secondary)",
                                borderBottom: i < CORES_SACOLA.length - 1 ? "1px solid var(--border)" : "none",
                              }}>
                              {corIdx === i && <span className="mr-2 text-xs">›</span>}{cor.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>NÚMERO DA SACOLA</p>
                      <input ref={inputRef} value={form.numero_sacola} onChange={e => set("numero_sacola", e.target.value)}
                        placeholder="Ex: 43"
                        className="w-full px-4 py-4 text-base rounded-2xl outline-none transition-all border-2"
                        style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                        autoComplete="off"/>
                    </div>
                  </div>
                </>}

                {/* ── Step 3: Itens e Valor ── */}
                {step === 3 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Itens e valor</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Quantidade de peças e o valor total da compra.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Qtd. de itens</p>
                      <input ref={inputRef} type="number" min="1" value={form.quantidade_itens}
                        onChange={e => set("quantidade_itens", e.target.value)}
                        className={iBase} style={iSt}/>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Valor total (R$)</p>
                      <input type="text" inputMode="decimal" value={form.valor_total}
                        onChange={e => set("valor_total", e.target.value.replace(",", "."))}
                        onBlur={e => { const v = parseFloat(e.target.value.replace(",", ".")); set("valor_total", isNaN(v) ? "0,00" : v.toFixed(2).replace(".", ",")) }}
                        placeholder="0,00" className={iBase} style={iSt}/>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Desconto (R$)</p>
                      <input type="text" inputMode="decimal" value={form.desconto}
                        onChange={e => set("desconto", e.target.value.replace(",", "."))}
                        onBlur={e => { const v = parseFloat(e.target.value.replace(",", ".")); set("desconto", isNaN(v) ? "0,00" : v.toFixed(2).replace(".", ",")) }}
                        placeholder="0,00" className={iBase} style={iSt}/>
                    </div>
                  </div>
                </>}

                {/* ── Step 4: Produtos ── */}
                {step === 4 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Produtos comprados</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Pesquise no estoque ou digite o nome do produto para adicionar.</p>

                  <div className="relative mb-4">
                    <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}/>
                    <input ref={inputRef} value={prodBusca} onChange={e => buscarProdutos(e.target.value)}
                      placeholder="BUSCAR OU DIGITAR PRODUTO..."
                      className={cn(iBase, "pl-12")} style={iSt} autoComplete="off"/>
                  </div>

                  {/* Dropdown de resultados + opção manual */}
                  {prodBusca.length > 0 && (prodRes.length > 0 || prodBusca.length >= 2) && (
                    <div className="mb-4 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                      {prodRes.map(p => (
                        <button key={p.id} onClick={() => adicionarItem(p)}
                          className="w-full px-4 py-3 text-left flex flex-col gap-0.5 transition-colors"
                          style={{ borderBottom: "1px solid var(--border)" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                          <p className="text-sm font-semibold uppercase" style={{ color: "var(--text-primary)" }}>{p.nome}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {p.preco ? fmtBRL(p.preco) : "Sem preço"} · Estoque: {p.estoque ?? 0}
                          </p>
                        </button>
                      ))}
                      {/* Sempre mostra opção manual quando há texto */}
                      <button onClick={() => adicionarItem({ nome: prodBusca })}
                        className="w-full px-4 py-3 text-left text-sm font-medium transition-colors"
                        style={{ background: "var(--bg-surface)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)" }}>
                        <span style={{ color: "var(--accent)" }}>+ Adicionar &quot;{prodBusca}&quot; manualmente</span>
                      </button>
                    </div>
                  )}

                  {itens.length > 0 && (
                    <div className="space-y-2 mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Itens adicionados ({itens.length})
                      </p>
                      {itens.map((it, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl"
                          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>{it.quantidade}×</span>
                            <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{it.nome_produto}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {it.preco_unitario > 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>{fmtBRL(it.quantidade * it.preco_unitario)}</p>}
                            <button onClick={() => setItens(prev => prev.filter((_, idx) => idx !== i))}
                              className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
                              <X size={13}/>
                            </button>
                          </div>
                        </div>
                      ))}
                      {totalItens > 0 && (
                        <p className="text-xs text-right font-semibold" style={{ color: "var(--text-secondary)" }}>
                          Total itens: {fmtBRL(totalItens)}
                        </p>
                      )}
                    </div>
                  )}
                </>}

                {/* Erro */}
                <AnimatePresence>
                  {erro && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-3 text-sm" style={{ color: "#f87171" }}>{erro}</motion.p>}
                </AnimatePresence>

                <div className="flex items-center gap-4 mt-8">
                  <button onClick={advance}
                    className="flex items-center gap-2 px-7 py-3 text-sm font-semibold text-white shadow-lg transition-opacity rounded-2xl"
                    style={{ background: COR_LIVE }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                    Continuar <ArrowRight size={15}/>
                  </button>
                  {step > 1 && (
                    <button onClick={() => go(step + 1)}
                      className="text-sm font-medium transition-colors" style={{ color: "var(--text-muted)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                      Pular →
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

          ) : (
            /* ── Step 5: Revisão ── */
            <motion.div key="revisao-compra" custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="absolute inset-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

              {/* Sidebar AZUL */}
              <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col items-center justify-between py-4 md:py-10 px-5 md:px-6 gap-4 md:gap-0"
                style={{ background: "linear-gradient(160deg, #1e40af 0%, #2563eb 60%, #3b82f6 100%)" }}>
                <div className="flex flex-row md:flex-col items-center gap-4 md:text-center">
                  {/* Ícone */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-4xl"
                      style={{ background: "rgba(255,255,255,0.18)" }}>
                      🛍️
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center"
                      style={{ background: "#22c55e" }}>
                      <Check size={10} color="#fff" className="md:hidden"/>
                      <Check size={14} color="#fff" className="hidden md:block"/>
                    </div>
                  </div>
                  {/* Dados */}
                  <div>
                    <p className="font-bold text-sm md:text-lg leading-tight text-white uppercase tracking-wide">
                      {form.nome_cliente || "—"}
                    </p>
                    <div className="w-10 h-px mx-auto my-1 md:my-2 hidden md:block" style={{ background: "rgba(255,255,255,0.3)" }}/>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 hidden md:block">Total da Compra</p>
                    <p className="text-lg md:text-2xl font-bold text-white mt-0.5 md:mt-1">
                      {parseFloat(form.valor_total) > 0 ? fmtBRL(parseFloat(form.valor_total)) : "R$ 0,00"}
                    </p>
                    <p className="text-xs text-white/50 mt-2 hidden md:block">Revise os dados antes de salvar</p>
                  </div>
                </div>
                <div className="flex flex-row md:flex-col gap-2 md:w-full shrink-0">
                  <button onClick={salvar} disabled={saving}
                    className="py-2.5 md:py-3 px-4 md:px-0 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 md:w-full"
                    style={{ background: "#fff", color: "#2563eb" }}>
                    {saving ? <><Loader2 size={15} className="animate-spin"/>Salvando...</> : "✓ Salvar"}
                  </button>
                  <button onClick={onClose} className="py-2.5 px-4 md:px-0 rounded-2xl text-sm font-medium md:w-full"
                    style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}>
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Painel revisão */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-10" style={{ background: "var(--bg-base)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-6" style={{ color: "var(--text-muted)" }}>
                  ◎ DADOS DA COMPRA
                </p>
                {erro && <p className="mb-4 text-sm px-4 py-2 rounded-xl" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>{erro}</p>}

                {/* Grid de campos */}
                <div className="grid grid-cols-2 gap-3">
                  {/* CLIENTE (full width) */}
                  {[
                    { label: "CLIENTE",       value: form.nome_cliente || "Não informado", s: 1, full: true },
                    { label: "DATA COMPRA",   value: fmtData(new Date().toISOString().split("T")[0]), s: 1 },
                    { label: "DATA LIVE",     value: liveData ? fmtData(liveData) : "—", s: 1 },
                    { label: "COR DA SACOLA", value: form.cor_sacola || "Não informado", s: 2 },
                    { label: "Nº SACOLA",     value: form.numero_sacola || "Não informado", s: 2 },
                    { label: "ITENS",         value: form.quantidade_itens || "1", s: 3 },
                    { label: "VALOR TOTAL",   value: fmtBRL(parseFloat(form.valor_total.replace(",", ".")) || 0), s: 3 },
                    { label: "DESCONTO",      value: fmtBRL(parseFloat(form.desconto || "0")), s: 3 },
                    { label: "WHATSAPP",      value: form.whatsapp || "Não informado", s: 1 },
                  ].map(({ label, value, s, full }) => (
                    <div key={label} className={cn("rounded-xl p-4", full ? "col-span-2" : "")}
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: "3px solid #22c55e" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="text-sm font-medium uppercase" style={{ color: value === "Não informado" ? "var(--text-muted)" : "var(--text-primary)" }}>
                        {value}
                      </p>
                      <button onClick={() => go(s)} className="flex items-center gap-1 text-xs mt-1 font-semibold uppercase tracking-wide" style={{ color: "#2563eb" }}>
                        ✎ EDITAR
                      </button>
                    </div>
                  ))}
                </div>

                {/* Produtos */}
                {itens.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                      Produtos ({itens.length})
                    </p>
                    <div className="space-y-2">
                      {itens.map((it, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl"
                          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                          <p className="text-sm uppercase" style={{ color: "var(--text-primary)" }}>{it.quantidade}× {it.nome_produto}</p>
                          {it.preco_unitario > 0 && <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{fmtBRL(it.quantidade * it.preco_unitario)}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {step < TOTAL && step > 1 && (
        <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => go(step - 1)}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)" }}>
            <ChevronLeft size={15} /> Voltar
          </button>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Pressione <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Enter</kbd> para avançar
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Renderiza texto estilo WhatsApp (*bold*) ─────────────
function WhatsAppText({ text }: { text: string }) {
  return (
    <span>
      {text.split("\n").map((line, i) => {
        const parts = line.split(/(\*[^*]+\*)/g)
        return (
          <span key={i}>
            {parts.map((p, j) =>
              p.startsWith("*") && p.endsWith("*") && p.length > 2
                ? <strong key={j} className="font-semibold">{p.slice(1, -1)}</strong>
                : <span key={j}>{p}</span>
            )}
            {i < text.split("\n").length - 1 && <br />}
          </span>
        )
      })}
    </span>
  )
}

// ─── Modal Disparar Mensagens ─────────────────────────────
function ModalDisparar({
  liveId, liveTitulo, liveData, compras, onClose, onSuccess,
}: {
  liveId: number
  liveTitulo: string
  liveData: string
  compras: LiveDetalhe["compras"]
  onClose: () => void
  onSuccess: () => void
}) {
  type Fase = "preview" | "disparando" | "resultado"
  const [fase, setFase] = useState<Fase>("preview")
  const [resultado, setResultado] = useState<{
    enviadas: number; erros: number
    resultados: Array<{ id: number; cliente: string; numero: string; status: string }>
  } | null>(null)

  const pendentes = compras.filter(c => !c.msg_status || c.msg_status === "pendente" || c.msg_status === "erro")
  const ex = pendentes[0]

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape" && fase !== "disparando") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose, fase])

  function fmtVal(v: number) {
    return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
  }

  function msgPreview(c: typeof ex) {
    if (!c) return ""
    const fmtD = (d?: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR")
    const linkAsaas = c.link_pagamento || "[link de pagamento será gerado]"
    const dataLive  = liveData ? fmtD(liveData) : fmtD(undefined)
    return (
`Olá! 💖

Obrigada pela sua participação em nossa live. Suas peças foram separadas com carinho. 🛍️

*Resumo da sua compra:*

📅 Data da compra: ${fmtD(c.data_compra)}
🎥 Data da live: ${dataLive}
🛍️ Sacola: ${c.numero_sacola || "—"}
🎨 Cor da Sacola: ${c.cor_sacola || "—"}
📦 Quantidade de Itens: ${c.quantidade_itens || 1}
💰 Valor total: ${fmtVal(c.valor_total)}

*Pagamento:*

O pagamento deve ser realizado até segunda-feira às 23:59, via PIX ou Cartão, para manter suas peças reservadas com carinho. 💖

💳 Link para pagamento:
${linkAsaas}

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
      setResultado(res)
      setFase("resultado")
      onSuccess()
    } catch {
      setFase("preview")
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 backdrop-blur-md" style={{ background: "rgba(0,0,0,0.75)" }}
        onClick={() => fase !== "disparando" && onClose()} />

      <motion.div initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{ background: "rgba(37,211,102,0.15)" }}>
              💬
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                Disparar Mensagens WhatsApp
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {liveTitulo || "Live"} · {fmtData(liveData)}
              </p>
            </div>
          </div>
          {fase !== "disparando" && (
            <button onClick={onClose} className="p-1.5 rounded-xl transition-colors" style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
              <X size={17} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Fase: Preview ── */}
          {(fase === "preview" || fase === "disparando") && (
            <div className="flex gap-0 h-full">
              {/* Lista de clientes */}
              <div className="w-56 shrink-0 border-r overflow-y-auto" style={{ borderColor: "var(--border)" }}>
                <div className="px-4 py-3 sticky top-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Destinatários
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--accent)" }}>
                    {pendentes.length} {pendentes.length === 1 ? "cliente" : "clientes"}
                  </p>
                </div>
                {pendentes.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nenhuma compra pendente</p>
                  </div>
                ) : pendentes.map(c => (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-2.5"
                    style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ background: "rgba(37,211,102,0.15)", color: "#25d366" }}>
                      {c.nome_cliente?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate uppercase" style={{ color: "var(--text-primary)" }}>{c.nome_cliente}</p>
                      <p className="text-[10px] truncate" style={{ color: c.whatsapp ? "var(--text-muted)" : "#f87171" }}>
                        {c.whatsapp ?? "⚠ Sem WhatsApp"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview da mensagem */}
              <div className="flex-1 flex flex-col">
                {/* Header estilo WhatsApp */}
                <div className="px-4 py-3 flex items-center gap-3 shrink-0"
                  style={{ background: "#075e54", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">👤</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{ex?.nome_cliente ?? "Cliente"}</p>
                    <p className="text-xs text-white/70">via Z-API · WhatsApp</p>
                  </div>
                </div>

                {/* Fundo chat */}
                <div className="flex-1 overflow-y-auto p-4" style={{ background: "#0b141a" }}>
                  {/* Bolha de mensagem */}
                  {ex ? (
                    <div className="flex justify-end mb-2">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg"
                        style={{ background: "#005c4b" }}>
                        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#e9edef" }}>
                          <WhatsAppText text={msgPreview(ex)} />
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-2">
                          <p className="text-[10px]" style={{ color: "rgba(233,237,239,0.55)" }}>
                            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <svg viewBox="0 0 18 11" className="w-4 h-3" fill="none">
                            <path d="M17.394.566L7.2 10.766 5.694 9.266M11.394.566L1.2 10.766" stroke="#53BDEB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-sm py-8" style={{ color: "rgba(233,237,239,0.4)" }}>
                      Nenhuma compra pendente para disparar.
                    </p>
                  )}
                </div>

                {/* Nota */}
                <div className="px-4 py-2.5 shrink-0" style={{ background: "rgba(37,211,102,0.06)", borderTop: "1px solid var(--border)" }}>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    ℹ️ Prévia baseada na 1ª compra. Cada cliente recebe sua mensagem personalizada.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Fase: Resultado ── */}
          {fase === "resultado" && resultado && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: resultado.erros === 0 ? "rgba(37,211,102,0.12)" : "rgba(251,191,36,0.12)" }}>
                  {resultado.erros === 0 ? "✅" : "⚠️"}
                </div>
                <div>
                  <p className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                    {resultado.erros === 0 ? "Mensagens enviadas!" : "Envio concluído com erros"}
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {resultado.enviadas} enviada{resultado.enviadas !== 1 ? "s" : ""} · {resultado.erros} erro{resultado.erros !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {resultado.resultados.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                    <span className="text-base">{r.status === "enviada" ? "✅" : "❌"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{r.cliente}</p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{r.numero || "Sem WhatsApp"}</p>
                    </div>
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full",
                      r.status === "enviada" ? "bg-emerald-600/12 text-emerald-400" : "bg-red-600/12 text-red-400")}>
                      {r.status === "enviada" ? "Enviado" : "Erro"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer ações */}
        <div className="px-6 py-4 shrink-0 flex items-center gap-3"
          style={{ borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          {fase === "resultado" ? (
            <button onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white"
              style={{ background: "#25d366" }}>
              Fechar
            </button>
          ) : (
            <>
              <button onClick={onClose} disabled={fase === "disparando"}
                className="flex-1 py-3 rounded-2xl text-sm font-medium transition-colors disabled:opacity-40"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Cancelar <span className="text-[10px] opacity-60 ml-1">(ESC)</span>
              </button>
              <button onClick={disparar} disabled={fase === "disparando" || pendentes.length === 0}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                style={{ background: "#25d366" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                {fase === "disparando"
                  ? <><Loader2 size={15} className="animate-spin" />Disparando...</>
                  : <><Send size={14} /> Confirmar e Disparar ({pendentes.length})</>}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Detalhe da Live ──────────────────────────────────────
function PainelDetalhe({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [addCompra,   setAddCompra]   = useState(false)
  const [disparModal, setDisparModal] = useState(false)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape" && !addCompra && !disparModal) onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose, addCompra, disparModal])

  const { data, isLoading } = useQuery<LiveDetalhe>({
    queryKey: ["live", id],
    queryFn:  () => apiGet(`/live/${id}`),
  })

  const mudarStatus = useMutation({
    mutationFn: (status: string) => apiPatch(`/live/${id}`, { status }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["lives"] }); qc.invalidateQueries({ queryKey: ["live", id] }) },
  })

  const excluir = useMutation({
    mutationFn: () => apiDelete(`/live/${id}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["lives"] }); onClose() },
  })

  const STATUS_MSG_BADGE: Record<string, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-amber-500/15 text-amber-400" },
    enviada:  { label: "Enviada",  cls: "bg-emerald-500/15 text-emerald-400" },
    erro:     { label: "Erro",     cls: "bg-red-500/15 text-red-400" },
  }
  const STATUS_LIVE_BADGE: Record<string, string> = {
    aberta:    "bg-emerald-500/15 text-emerald-600",
    encerrada: "bg-slate-400/15 text-slate-500",
    disparada: "bg-blue-500/15 text-blue-500",
  }

  const titulo = data
    ? (data.titulo ? data.titulo.toUpperCase() : `LIVE ${fmtData(data.data_live).toUpperCase()}`)
    : `LIVE ${id}`

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col overflow-hidden"
        style={{ background: "var(--bg-base)" }}>

        {/* ── Header ── */}
        <div className="shrink-0 px-6 py-4 flex items-center gap-4"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl transition-colors shrink-0"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
            <ChevronLeft size={15}/> Voltar
          </button>

          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-bold text-lg truncate" style={{ color: "var(--text-primary)" }}>{titulo}</h2>
            {data && (
              <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full capitalize shrink-0",
                STATUS_LIVE_BADGE[data.status] ?? "bg-slate-400/15 text-slate-500")}>
                {data.status}
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button onClick={() => setAddCompra(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
              <Plus size={14}/> Adicionar Compra
            </button>
            <button onClick={() => setDisparModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity"
              style={{ background: COR_LIVE }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
              <Send size={14}/> 🎯 Disparar Mensagens
            </button>
            {data?.status === "aberta" && (
              <button onClick={() => mudarStatus.mutate("encerrada")}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                Encerrar
              </button>
            )}
            <button onClick={() => { if (confirm("Excluir esta live?")) excluir.mutate() }}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors text-red-400"
              style={{ border: "1px solid var(--border)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
              Excluir
            </button>
          </div>
        </div>

        {/* ── Conteúdo ── */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }}/>
            </div>
          ) : data ? (
            <>
              {/* Métricas */}
              <div className="grid grid-cols-4 gap-4 px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
                {[
                  { label: "Clientes",          value: String(data.compras?.length ?? 0) },
                  { label: "Total Arrecadado",   value: fmtBRL(data.compras?.reduce((s,c) => s + (c.valor_total ?? 0), 0) ?? 0) },
                  { label: "Mensagens Enviadas", value: String(data.compras?.filter(c => c.msg_status === "enviada").length ?? 0) },
                  { label: "Pendentes",          value: String(data.compras?.filter(c => !c.msg_status || c.msg_status === "pendente").length ?? 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl p-5"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>{label}</p>
                    <p className="font-bold text-2xl mt-1.5" style={{ color: "var(--text-primary)" }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Tabela */}
              <div className="px-6 py-5">
                <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                  Compras desta live
                </p>

                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                        {["Cliente","Sacola","Itens","Valor","WhatsApp","Status Msg","Pago"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(data.compras?.length ?? 0) === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <span className="text-5xl">🛍️</span>
                              <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Nenhuma compra cadastrada</p>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Clique em &quot;Adicionar Compra&quot; para registrar</p>
                            </div>
                          </td>
                        </tr>
                      ) : data.compras.map(c => {
                        const msgBadge = STATUS_MSG_BADGE[c.msg_status ?? "pendente"] ?? STATUS_MSG_BADGE.pendente
                        const sacola = [c.cor_sacola, c.numero_sacola ? `#${c.numero_sacola}` : ""].filter(Boolean).join(" ") || "—"
                        return (
                          <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}
                            className="transition-colors"
                            onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)" }}
                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent" }}>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>{c.nome_cliente}</p>
                            </td>
                            <td className="px-4 py-3 text-sm capitalize" style={{ color: "var(--text-secondary)" }}>{sacola}</td>
                            <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{c.quantidade_itens ?? 1}</td>
                            <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmtBRL(c.valor_total)}</td>
                            <td className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>{c.whatsapp ?? "—"}</td>
                            <td className="px-4 py-3">
                              <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full", msgBadge.cls)}>
                                {msgBadge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-400/10 text-slate-400">
                                —
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </motion.div>

      <AnimatePresence>
        {addCompra && (
          <WizardCompra
            liveId={id}
            liveData={data?.data_live}
            onClose={() => setAddCompra(false)}
            onSalvo={() => {
              qc.invalidateQueries({ queryKey: ["live", id] })
              qc.invalidateQueries({ queryKey: ["lives"] })
            }}
          />
        )}
        {disparModal && data && (
          <ModalDisparar
            liveId={id}
            liveTitulo={data.titulo ?? ""}
            liveData={data.data_live}
            compras={data.compras ?? []}
            onClose={() => setDisparModal(false)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["live", id] })
              qc.invalidateQueries({ queryKey: ["lives"] })
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Página Principal ─────────────────────────────────────
export default function LivePage() {
  const [wizard, setWizard]       = useState(false)
  const [detalhe, setDetalhe]     = useState<number | null>(null)
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>Live Commerce</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{data?.total ?? 0} lives</p>
        </div>
        <button onClick={() => setWizard(true)}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white shadow-lg transition-opacity"
          style={{ background: COR_LIVE }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
          <Radio size={15}/> Nova Live
        </button>
      </div>

      <div className="rounded-2xl px-4 py-3 flex gap-1.5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {["","aberta","encerrada","disparada"].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all"
            style={{ background: statusFiltro === s ? "var(--accent)" : "transparent", color: statusFiltro === s ? "#fff" : "var(--text-secondary)" }}>
            {s || "Todas"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["","Título","Data","Plataforma","Status","Criada em"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-wider ${i >= 2 ? "text-center" : "text-left"}`} style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "var(--accent)" }} />
                </td></tr>
              ) : lives.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <Radio size={32} className="mx-auto mb-2" style={{ color: "var(--border-hover)" }}/>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhuma live encontrada.</p>
                </td></tr>
              ) : lives.map(l => {
                const plat = PLATAFORMAS.find(p => p.value === l.plataforma)
                return (
                  <tr key={l.id} className="transition-colors cursor-pointer" style={{ borderBottom: "1px solid var(--border)" }}
                    onClick={() => setDetalhe(l.id)}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent" }}>
                    <td className="px-4 py-3">
                      <ChevronRight size={15} style={{ color: "var(--text-muted)" }}/>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>{l.titulo || "SEM TÍTULO"}</td>
                    <td className="px-4 py-3 text-sm text-center" style={{ color: "var(--text-secondary)" }}>{fmtData(l.data_live)}</td>
                    <td className="px-4 py-3 text-center">
                      {plat ? (
                        <span className="scale-75 inline-block">{plat.icon}</span>
                      ) : (
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full uppercase", STATUS_COLORS[l.status] ?? "bg-slate-500/15 text-slate-400")}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center" style={{ color: "var(--text-muted)" }}>{fmtData(l.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {wizard && <WizardLive onClose={() => setWizard(false)} onSalvo={(id) => { setWizard(false); setDetalhe(id) }} />}
        {detalhe !== null && <PainelDetalhe id={detalhe} onClose={() => setDetalhe(null)} />}
      </AnimatePresence>
    </div>
  )
}
