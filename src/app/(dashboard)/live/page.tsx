"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import {
  Plus, Loader2, X, ChevronLeft, ArrowRight, Radio, Send,
  Check, Search, ShoppingBag, User, ChevronDown, Package,
  AlertTriangle, AlertCircle, CheckCircle2, Link2, Trash2, ChevronRight,
  Zap, Clock, Circle, Ban, RefreshCw, TrendingUp, Users,
  MessageSquare, PackageCheck, Lock, Pencil, Save, MessageCircle, Camera as CameraIcon,
} from "lucide-react"
import { apiGet, apiPost, apiPatch, apiDelete } from "@/services/api"
import { useDropdownKeyNav } from "@/hooks/useKeyNav"
import DatePicker from "@/components/DatePicker"
import { fmtBRL, fmtData, cn } from "@/lib/utils"
import {
  buildCompleteMessage,
  selectSmallTalkIndex,
  CHAR_LIMIT,
  CHAR_TARGET,
  type CompraData,
  type MessageResult,
} from "@/lib/live-message-builder"
import { useDisparoStore } from "@/stores/disparo.store"
import { regraParcelamento, corRegraParcelamento, calcularValorFinal, avisoParcelamento } from "@/lib/parcelamento"
import type { Live } from "@/types"
import BuscaClienteGlobal from "@/components/live/BuscaClienteGlobal"
import ImportarPorFoto from "@/components/live/ImportarPorFoto"

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
  credito_aplicado?: number
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
  id: number; nome: string; cpf_cnpj?: string | null; celular?: string | null; instagram?: string | null; saldo_credito?: number | null
}

interface ProdutoVinculo {
  id: number
  compra_id: number
  produto_id?: number
  nome_produto: string
  codigo_produto?: string | null
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
  quantidade_itens: "",
  valor_total: "", desconto: "", observacao: "",
  link_pagamento: "",
}

const CORES_SACOLA = ["AMARELO","AZUL","BRANCO","LARANJA","ROSA PINK","VERDE","VERDE ÁGUA"]

function gerarArroba(nome: string): string {
  const palavras = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return ""
  const first = palavras[0]
  const last = palavras.length > 1 ? palavras[palavras.length - 1] : ""
  return "@" + first + last
}
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
  finalizada:       { label: "Não Retirado",          cor: "#f97316", bg: "rgba(249,115,22,0.15)",  icon: <Clock size={11}/> },
  retirada:         { label: "Retirado",             cor: "#10b981", bg: "rgba(16,185,129,0.2)",   icon: <CheckCircle2 size={11}/> },
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
  const todasVinculadas = compras.every(c => c.status_compra === "vinculada" || c.status_compra === "finalizada" || c.status_compra === "retirada")
  if (!todasVinculadas) return 4                                                         // msgs ok → ir para PRODUTOS
  const todasFinalizadas = compras.every(c => c.status_compra === "finalizada" || c.status_compra === "retirada")
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
type WizardFase = "wizard" | "criando" | "sucesso"

function WizardLive({ onClose, onSalvo }: { onClose: () => void; onSalvo: (id: number) => void }) {
  const qc = useQueryClient()
  const [step, setStep]     = useState(1)
  const [dir, setDir]       = useState(1)
  const [form, setForm]     = useState<LiveForm>(EMPTY_LIVE)
  const [erro, setErro]     = useState("")
  const [platIdx, setPlatIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const TOTAL = 3

  // ── Fase de carregamento ──
  const [fase, setFase]           = useState<WizardFase>("wizard")
  const [temAviso, setTemAviso]   = useState(false)
  const [confirmSemLink, setConfirmSemLink] = useState(false)
  const iniciarAviso = useDisparoStore(s => s.iniciarAviso)

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 280); return () => clearTimeout(t) }, [step])
  useEffect(() => {
    if (step === 2) setPlatIdx(PLATAFORMAS.findIndex(p => p.value === form.plataforma) || 0)
  }, [step]) // eslint-disable-line

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape" && fase === "wizard") onClose() }
    document.addEventListener("keydown", fn); return () => document.removeEventListener("keydown", fn)
  }, [onClose, fase])

  function set(k: keyof LiveForm, v: string) { setForm(f => ({ ...f, [k]: v })); setErro("") }
  function go(next: number) { setDir(next > step ? 1 : -1); setStep(next); setErro("") }

  function advance() {
    if (step === 1 && !form.data_live) { setErro("Informe a data da live"); return }
    if (step < TOTAL) go(step + 1); else handleSalvar()
  }

  async function handleSalvar(forcarSemLink = false) {
    // Se não há link e ainda não confirmou, pede confirmação (sem link = sem aviso)
    if (!form.link_live?.trim() && !forcarSemLink) {
      setConfirmSemLink(true)
      return
    }
    setConfirmSemLink(false)
    setErro("")
    setFase("criando")
    try {
      // 1. Cria a live
      const nova = await apiPost<{ id: number }>("/live", {
        data_live:  form.data_live,
        titulo:     form.titulo || null,
        plataforma: form.plataforma || null,
        tipo:       form.tipo,
        link_live:  form.link_live || null,
      })
      qc.invalidateQueries({ queryKey: ["lives"] })

      // 2. Se tem link, dispara o aviso em SEGUNDO PLANO (widget flutuante).
      // Não bloqueia: a tela vai para "sucesso" e navega para a live, e o
      // envio para as clientes continua rodando no widget do canto.
      if (form.link_live?.trim()) {
        iniciarAviso({
          liveId: nova.id,
          liveTitulo: form.titulo?.trim() || `Live ${fmtData(form.data_live)}`,
          link: form.link_live.trim(),
        })
        setTemAviso(true)
      }

      setFase("sucesso")
      setTimeout(() => { onSalvo(nova.id) }, 1800)
    } catch {
      setErro("Erro ao criar live. Tente novamente.")
      setFase("wizard")
    }
  }

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (fase !== "wizard") return
    if (step === 2) {
      if (e.key === "ArrowLeft") { e.preventDefault(); setPlatIdx(i => (i - 1 + PLATAFORMAS.length) % PLATAFORMAS.length); return }
      if (e.key === "ArrowRight") { e.preventDefault(); setPlatIdx(i => (i + 1) % PLATAFORMAS.length); return }
      if (e.key === "Enter") { e.preventDefault(); set("plataforma", PLATAFORMAS[platIdx].value); go(3); return }
    }
    if (e.key === "Enter") { e.preventDefault(); advance() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, platIdx, fase])

  const iBase = "w-full px-5 py-4 text-lg rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }

  // ── Tela de carregamento / sucesso ──
  if (fase !== "wizard") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center"
        style={{ background: "var(--bg-base)" }}>

        <AnimatePresence mode="wait">
          {/* CRIANDO */}
          {fase === "criando" && (
            <motion.div key="criando"
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              className="flex flex-col items-center gap-6 px-8 text-center">
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                  className="w-20 h-20 rounded-full"
                  style={{ background: `${COR_LIVE}20`, border: `2px solid ${COR_LIVE}40` }}/>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: COR_LIVE }}/>
                </div>
              </div>
              <div>
                <p className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Criando sua live...</p>
                <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>Aguarde um momento</p>
              </div>
            </motion.div>
          )}

          {/* SUCESSO */}
          {fase === "sucesso" && (
            <motion.div key="sucesso"
              initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="flex flex-col items-center gap-5 px-8 text-center">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.1 }}
                className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                style={{ background: "rgba(16,185,129,0.12)", border: "2px solid rgba(16,185,129,0.3)" }}>
                ✅
              </motion.div>
              <div>
                <p className="text-2xl font-black" style={{ color: "#10b981" }}>Live criada!</p>
                {temAviso
                  ? <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                      Avisando as clientes em segundo plano 📣
                    </p>
                  : <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Redirecionando...</p>
                }
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // ── Wizard normal ──
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
                  <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    Instagram ou TikTok — ao criar a live, as clientes serão avisadas automaticamente. 🔔
                  </p>
                </div>
              </>}

              {step === 2 && <>
                <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Qual a plataforma?</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Onde a live foi transmitida.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      {step > 1 && step !== 2 && (
        <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => go(step - 1)} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            <ChevronLeft size={15}/> Voltar
          </button>
        </div>
      )}

      {/* Confirmação — criar live SEM link (sem aviso automático) */}
      <AnimatePresence>
        {confirmSemLink && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
            onClick={() => setConfirmSemLink(false)}>
            <motion.div
              initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl p-6 text-center"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <div className="text-4xl mb-3">🔔</div>
              <p className="text-lg font-black mb-2" style={{ color: "var(--text-primary)" }}>
                Criar sem avisar as clientes?
              </p>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                Você não preencheu o <strong>link da live</strong>. Sem ele, as clientes
                <strong> não serão avisadas automaticamente</strong>. Você pode voltar e adicionar o link agora.
              </p>
              <div className="flex flex-col gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setConfirmSemLink(false); go(1); setTimeout(() => inputRef.current?.focus(), 300) }}
                  className="w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-wide text-white shadow-lg"
                  style={{ background: COR_LIVE }}>
                  ← Voltar e adicionar o link
                </motion.button>
                <button
                  onClick={() => handleSalvar(true)}
                  className="w-full py-3 rounded-xl text-sm font-semibold"
                  style={{ color: "var(--text-muted)" }}>
                  Criar mesmo assim, sem avisar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════
// WIZARD — Adicionar Compra (rápido, sem produtos)
// ══════════════════════════════════════════════════════════
function WizardCompra({ liveId, liveData, onClose, onSalvo }: { liveId: number; liveData: string; onClose: () => void; onSalvo: () => void }) {
  const [step, setStep]     = useState(1)
  const [dir,  setDir]      = useState(1)
  const [form, setForm]     = useState<CompraForm>(EMPTY_COMPRA)
  const [erro, setErro]     = useState("")
  const [saving, setSaving] = useState(false)
  const [compraSalva, setCompraSalva] = useState<Compra | null>(null)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const TOTAL = 4

  const [cliBusca, setCliBusca] = useState("")
  const [cliRes,   setCliRes]   = useState<Cliente[]>([])
  const [cliSel,   setCli]      = useState<Cliente | null>(null)
  const [corIdx,   setCorIdx]   = useState(0)
  const [saldoCredito, setSaldoCredito] = useState(0)
  const [cliFocused, setCliFocused] = useState(false)

  useEffect(() => { const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }; document.addEventListener("keydown", fn); return () => document.removeEventListener("keydown", fn) }, [onClose])
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 280); return () => clearTimeout(t) }, [step])
  useEffect(() => {
    if (step === 2) { const idx = form.cor_sacola ? CORES_SACOLA.indexOf(form.cor_sacola) : -1; setCorIdx(idx >= 0 ? idx : 0) }
  }, [step]) // eslint-disable-line

  const buscarClientes = useCallback(async (val: string) => {
    setCliBusca(val); setCli(null)
    const query = val.startsWith("@") ? val.slice(1) : val
    try {
      const url = query.length >= 1
        ? `/clientes?busca=${encodeURIComponent(query)}&limit=8`
        : `/clientes?limit=8&ordem=recente`
      const res = await apiGet<{ data: Cliente[] }>(url)
      setCliRes(res.data ?? [])
    } catch { setCliRes([]) }
  }, [])

  const carregarRecentes = useCallback(async () => {
    try { const res = await apiGet<{ data: Cliente[] }>(`/clientes?limit=8&ordem=recente`); setCliRes(res.data ?? []) }
    catch { setCliRes([]) }
  }, [])

  function selCliente(c: Cliente) {
    setCli(c); setCliBusca(c.nome); setCliRes([])
    setForm(f => ({ ...f, cliente_id: c.id, nome_cliente: c.nome, whatsapp: c.celular ?? "" }))
    setSaldoCredito(Number(c.saldo_credito ?? 0))
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
    if (saving || compraSalva) return
    if (!form.valor_total) { setErro("Informe o valor total"); return }
    setSaving(true); setErro("")
    try {
      const valorTotalNum = parseFloat(form.valor_total.replace(/\./g, "").replace(",", ".")) || 0
      const creditoAplicado = form.cliente_id ? Math.min(saldoCredito, valorTotalNum) : 0
      const res = await apiPost<{ id: number }>(`/live/${liveId}/compras`, {
        cliente_id:        form.cliente_id ?? undefined,
        nome_cliente:      form.nome_cliente || cliBusca.trim(),
        whatsapp:          form.whatsapp || undefined,
        data_compra:       liveData || undefined,
        cor_sacola:        form.cor_sacola || undefined,
        numero_sacola:     form.numero_sacola || undefined,
        quantidade_itens:  parseInt(form.quantidade_itens) || 1,
        valor_total:       valorTotalNum,
        desconto:          parseFloat(form.desconto.replace(/\./g, "").replace(",", ".")) || 0,
        credito_aplicado:  creditoAplicado,
        observacao:        form.observacao || undefined,
        link_pagamento:    form.link_pagamento || undefined,
        status_compra:     "cadastrada",
      })
      onSalvo()
      setCompraSalva({
        id:              res.id,
        nome_cliente:    form.nome_cliente || cliBusca.trim(),
        whatsapp:        form.whatsapp || undefined,
        cor_sacola:      form.cor_sacola || undefined,
        numero_sacola:   form.numero_sacola || undefined,
        quantidade_itens: parseInt(form.quantidade_itens) || 1,
        valor_total:     valorTotalNum,
        desconto:        parseFloat(form.desconto.replace(/\./g, "").replace(",", ".")) || 0,
        credito_aplicado: creditoAplicado,
        msg_status:      "pendente",
      })
    } catch { setErro("Erro ao registrar compra.") } finally { setSaving(false) }
  }

  // Reseta o formulário para lançar outra compra rápido (fluxo de live)
  function novaCompra() {
    setCompraSalva(null); setForm(EMPTY_COMPRA)
    setCli(null); setCliBusca(""); setCliRes([]); setSaldoCredito(0); setCorIdx(0)
    setErro(""); setDir(-1); setStep(1)
  }

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (compraSalva) return
    if (step === 1) { if (e.key === "Enter" && cliRes.length === 0) { e.preventDefault(); advance() }; return }
    if (step === 2) {
      if (e.key === "ArrowDown") { e.preventDefault(); setCorIdx(i => { const n = (i+1)%CORES_SACOLA.length; setForm(f => ({...f, cor_sacola: CORES_SACOLA[n]})); return n }); return }
      if (e.key === "ArrowUp")   { e.preventDefault(); setCorIdx(i => { const n = (i-1+CORES_SACOLA.length)%CORES_SACOLA.length; setForm(f => ({...f, cor_sacola: CORES_SACOLA[n]})); return n }); return }
      if (e.key === "Enter" && form.cor_sacola) { e.preventDefault(); advance(); return }
    }
    if (e.key === "Enter" && step < TOTAL) { e.preventDefault(); advance() }
    if (e.key === "Enter" && step === TOTAL) { e.preventDefault(); salvar() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, cliRes, corIdx, compraSalva, saving])

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
        {compraSalva ? (
          <motion.div key="sucesso" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
              style={{ background: "rgba(16,185,129,0.12)", border: "2px solid rgba(16,185,129,0.3)" }}>
              <Check size={38} style={{ color: "#10b981" }}/>
            </motion.div>
            <h1 className="text-2xl font-black mb-1" style={{ color: "var(--text-primary)" }}>Compra registrada!</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              <span className="font-semibold uppercase">{compraSalva.nome_cliente}</span> · {fmtBRL(compraSalva.valor_total ?? 0)}
            </p>
            <p className="text-xs mt-1 mb-8" style={{ color: "var(--text-muted)" }}>
              Vincule os produtos depois, na lista de compras da live.
            </p>
            <div className="flex items-center gap-3">
              <button onClick={novaCompra}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white shadow-lg"
                style={{ background: COR_LIVE }}>
                <Plus size={15}/> Adicionar outra
              </button>
              <button onClick={onClose}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <Check size={15}/> Concluir
              </button>
            </div>
          </motion.div>
        ) : (
        <AnimatePresence custom={dir} mode="wait">
          <motion.div key={step} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="absolute inset-0 overflow-y-auto">
            <div className="min-h-full flex flex-col items-center justify-center px-4 sm:px-6 py-4">
            <div className="w-full max-w-xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base font-bold" style={{ color: COR_LIVE }}>{step}</span>
                <ArrowRight size={14} style={{ color: COR_LIVE }}/>
              </div>

              {/* Step 1 — Cliente */}
              {step === 1 && <>
                <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Qual cliente?</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Busque pelo nome, CPF, WhatsApp ou @Instagram.</p>
                <div className="relative mb-2">
                  <input ref={inputRef} value={cliBusca}
                    onChange={e => { buscarClientes(e.target.value); resetCli() }}
                    onKeyDown={cliKD}
                    onFocus={() => { setCliFocused(true); if (!cliBusca) carregarRecentes() }}
                    onBlur={() => setTimeout(() => setCliFocused(false), 150)}
                    placeholder="NOME, CPF, WHATSAPP OU @INSTAGRAM..."
                    className="w-full px-4 py-4 text-base rounded-xl outline-none transition-all border"
                    style={{ background: "var(--bg-surface)", borderColor: cliFocused ? "var(--accent)" : "var(--border)", color: "var(--text-primary)" }}
                    autoComplete="off"/>
                </div>
                {cliFocused && cliRes.length > 0 && !cliSel && (
                  <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                    {!cliBusca && (
                      <div className="px-4 py-2 flex items-center gap-1.5" style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                        <Clock size={11} style={{ color: "var(--text-muted)" }}/>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Recentes</span>
                      </div>
                    )}
                    {cliRes.map((c, idx) => (
                      <button key={c.id} onMouseDown={() => selCliente(c)}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                        style={{ borderBottom: idx < cliRes.length - 1 ? "1px solid var(--border)" : "none", background: cliHi === idx ? "var(--bg-hover)" : "var(--bg-surface)" }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                          {c.nome[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold uppercase truncate" style={{ color: "var(--text-primary)" }}>
                            {c.nome}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {c.instagram && (
                              <span className="text-xs" style={{ color: "var(--accent)" }}>
                                @{c.instagram.replace(/^@/, "")}
                              </span>
                            )}
                            {c.celular && (
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{c.celular}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }}/>
                      </button>
                    ))}
                  </div>
                )}
                {cliSel && (
                  <div className="mt-2 px-4 py-2 rounded-xl flex items-center gap-2"
                    style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <Check size={13} style={{ color: "#16a34a" }}/>
                    <p className="text-sm font-medium uppercase" style={{ color: "#15803d" }}>{cliSel.nome} selecionado</p>
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
                  <input ref={inputRef} type="number" min="1" inputMode="numeric" value={form.quantidade_itens}
                    onChange={e => set("quantidade_itens", e.target.value)}
                    className={iBase} style={iSt}/>
                </div>
              </>}

              {/* Step 4 — Valor */}
              {step === 4 && (() => {
                const valorTotalNum = parseFloat((form.valor_total || "0").replace(/\./g, "").replace(",", ".")) || 0
                const creditoAplicado = form.cliente_id ? Math.min(saldoCredito, valorTotalNum) : 0
                const valorFinal = Math.max(0, valorTotalNum - creditoAplicado)
                const saldoRestante = Math.max(0, saldoCredito - creditoAplicado)
                const temCredito = saldoCredito > 0 && form.cliente_id
                return <>
                  <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Valor da compra</h1>

                  {/* Input compacto */}
                  <div className="mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>VALOR TOTAL</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>R$</span>
                      <input ref={inputRef} inputMode="decimal" value={form.valor_total} onChange={e => set("valor_total", e.target.value)}
                        onBlur={() => { const n = parseFloat(form.valor_total.replace(/\./g,"").replace(",",".")); if (!isNaN(n) && n > 0) set("valor_total", n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })) }}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2.5 text-lg font-bold rounded-xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
                        style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
                    </div>
                  </div>

                  {/* Card único: crédito + resumo juntos */}
                  <div className="rounded-xl overflow-hidden mb-2" style={{ border: `1px solid ${temCredito ? "rgba(52,211,153,0.35)" : "var(--border)"}`, background: temCredito ? "rgba(52,211,153,0.04)" : "var(--bg-card)" }}>

                    {/* Linha de crédito — só aparece se houver */}
                    {temCredito && (
                      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(52,211,153,0.2)" }}>
                        <motion.span className="text-base" animate={{ scale: [1,1.15,1] }} transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}>🎁</motion.span>
                        <span className="flex-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#34d399" }}>Crédito disponível</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}>{fmtBRL(saldoCredito)}</span>
                      </div>
                    )}

                    {/* Linhas do resumo */}
                    <div className="divide-y" style={{ borderColor: temCredito ? "rgba(52,211,153,0.15)" : "var(--border)" }}>
                      {[
                        { l: "Cliente",   v: form.nome_cliente || cliBusca || "—", h: false },
                        { l: "Cor",       v: form.cor_sacola || "—",               h: false },
                        { l: "Nº Sacola", v: form.numero_sacola ? `#${form.numero_sacola}` : "—", h: false },
                        { l: "Itens",     v: `${form.quantidade_itens} item(ns)`,  h: false },
                      ].map(r => (
                        <div key={r.l} className="flex justify-between items-center px-3 py-1.5">
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{r.l}</span>
                          <span className="text-[11px] font-semibold uppercase" style={{ color: "var(--text-primary)" }}>{r.v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Bloco de valores */}
                    <div className="px-3 py-2 space-y-1" style={{ borderTop: `1px solid ${temCredito ? "rgba(52,211,153,0.2)" : "var(--border)"}` }}>
                      {temCredito && valorTotalNum > 0 ? (<>
                        <div className="flex justify-between text-[11px]">
                          <span style={{ color: "var(--text-muted)" }}>Valor original</span>
                          <span style={{ color: "var(--text-secondary)" }}>{fmtBRL(valorTotalNum)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span style={{ color: "#34d399" }}>Crédito aplicado</span>
                          <span className="font-semibold" style={{ color: "#34d399" }}>− {fmtBRL(creditoAplicado)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold pt-1" style={{ borderTop: "1px solid rgba(52,211,153,0.2)" }}>
                          <span style={{ color: valorFinal === 0 ? "#34d399" : "var(--text-primary)" }}>
                            {valorFinal === 0 ? "✅ Pago com crédito" : "Total final"}
                          </span>
                          <span style={{ color: valorFinal === 0 ? "#34d399" : "var(--text-primary)" }}>{fmtBRL(valorFinal)}</span>
                        </div>
                        {saldoRestante > 0 && (
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Saldo restante: {fmtBRL(saldoRestante)}</p>
                        )}
                      </>) : (
                        <div className="flex justify-between text-xs font-bold">
                          <span style={{ color: "var(--text-primary)" }}>Total</span>
                          <span style={{ color: "var(--text-primary)" }}>{form.valor_total ? fmtBRL(parseFloat(form.valor_total.replace(/\./g,"").replace(",","."))) : "—"}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <motion.button onClick={salvar} disabled={saving} whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white shadow-lg disabled:opacity-60"
                    style={{ background: COR_LIVE }}>
                    {saving ? <><Loader2 size={14} className="animate-spin"/>Salvando...</> : <><ShoppingBag size={15}/>Registrar Compra</>}
                  </motion.button>
                </>
              })()}

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
            </div>
          </motion.div>
        </AnimatePresence>
        )}
      </div>

      {step > 1 && !compraSalva && (
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

// Anel de progresso SVG circular
function RingProgress({ pct, size = 80 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const done = pct >= 100
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={5}
        stroke="var(--bg-surface)" strokeLinecap="round"/>
      <motion.circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={5}
        stroke={done ? "#10b981" : "var(--accent)"} strokeLinecap="round"
        strokeDasharray={circ}
        animate={{ strokeDashoffset: circ - (circ * Math.min(pct, 100)) / 100 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ filter: done ? "drop-shadow(0 0 6px #10b981aa)" : "drop-shadow(0 0 4px var(--accent))" }}/>
    </svg>
  )
}

// Partículas de confete ao completar
function Confetti() {
  const pieces = Array.from({ length: 18 }, (_, i) => ({
    x: (Math.random() - 0.5) * 260,
    y: -(60 + Math.random() * 100),
    rot: Math.random() * 720 - 360,
    color: ["#10b981","#6366f1","#f59e0b","#ec4899","#3b82f6","#a78bfa"][i % 6],
    size: 4 + Math.random() * 6,
  }))
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center overflow-hidden">
      {pieces.map((p, i) => (
        <motion.div key={i}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rot, scale: 0 }}
          transition={{ duration: 1.2, delay: i * 0.04, ease: "easeOut" }}
          style={{ position: "absolute", bottom: 0, width: p.size, height: p.size, borderRadius: Math.random() > 0.5 ? "50%" : "2px", background: p.color }}/>
      ))}
    </div>
  )
}

// Ilustração SVG animada para empty state
function EmptyIllustration() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Sacola base */}
      <motion.rect x="25" y="38" width="70" height="52" rx="10"
        fill="var(--bg-surface)" stroke="var(--border)" strokeWidth="2"
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}/>
      {/* Alça esquerda */}
      <motion.path d="M42 38 C42 28 44 18 60 18 C76 18 78 28 78 38" fill="none"
        stroke="var(--border)" strokeWidth="2.5" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}/>
      {/* Linhas internas indicando vazio */}
      <motion.line x1="40" y1="58" x2="80" y2="58" stroke="var(--border)" strokeWidth="2" strokeLinecap="round"
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 0.4 }}
        style={{ transformOrigin: "left" }}/>
      <motion.line x1="45" y1="68" x2="75" y2="68" stroke="var(--border)" strokeWidth="2" strokeLinecap="round"
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.65, duration: 0.4 }}
        style={{ transformOrigin: "left" }}/>
      {/* Ponto flutuante de interrogação */}
      <motion.text x="57" y="80" fill="var(--text-muted)" fontSize="18" fontWeight="900" fontFamily="sans-serif"
        animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}>
        +
      </motion.text>
      {/* Estrelinhas */}
      {[[10,20],[100,15],[108,60],[8,70]].map(([cx,cy],i) => (
        <motion.circle key={i} cx={cx} cy={cy} r={2.5} fill="var(--accent)"
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
          transition={{ repeat: Infinity, duration: 1.8 + i * 0.4, delay: i * 0.3 }}/>
      ))}
    </svg>
  )
}

function ModalVinculo({
  liveId, compra, onClose, onAtualizado,
}: { liveId: number; compra: Compra; onClose: () => void; onAtualizado: () => void }) {
  const [busca,   setBusca]   = useState("")
  const [prodRes, setProdRes] = useState<Array<{ id: number; nome: string; codigo?: string | null; preco_venda?: number; estoque_atual?: number }>>([])
  const [form,    setForm]    = useState({ produto_id: 0, nome_produto: "", codigo_produto: "", quantidade: "", preco_original: "", preco_live: "" })
  const [saving,  setSaving]  = useState(false)
  const [erro,    setErro]    = useState("")
  const [finalizando, setFin] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [searchFocus, setSearchFocus] = useState(false)
  const prevPct = useRef(0)

  const { data: produtos, refetch } = useQuery({
    queryKey: ["live-compra-produtos", compra.id],
    queryFn: () => apiGet<ProdutoVinculo[]>(`/live/${liveId}/compras/${compra.id}/produtos`),
    initialData: [],
  })

  const totalVinculado = (produtos ?? []).reduce((s, p) => s + p.quantidade, 0)
  const qtdEsperada = compra.quantidade_itens ?? 0
  const progresso = qtdEsperada > 0 ? Math.min(100, (totalVinculado / qtdEsperada) * 100) : 0
  const podeFinalizar = totalVinculado >= qtdEsperada && (produtos ?? []).every(p => p.estoque_baixado)

  // Dispara confete ao atingir 100%
  useEffect(() => {
    if (progresso >= 100 && prevPct.current < 100) {
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 1400)
      return () => clearTimeout(t)
    }
    prevPct.current = progresso
  }, [progresso])

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
    const precoNum = Number(p.preco_venda) || 0
    const preco = precoNum > 0 ? precoNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""
    setForm({ produto_id: p.id, nome_produto: p.nome, codigo_produto: p.codigo ?? "", quantidade: "1", preco_original: preco, preco_live: "" })
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
      setForm({ produto_id: 0, nome_produto: "", codigo_produto: "", quantidade: "", preco_original: "", preco_live: "" })
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

  // Calcula desconto % para mostrar no badge
  function descPct(orig: number, live: number) {
    if (!orig || !live || live >= orig) return 0
    return Math.round((1 - live / orig) * 100)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-x-0 bottom-0 z-[15] flex"
      style={{ top: "var(--topbar-height, 52px)", background: "var(--bg-base)" }}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        className="w-full flex flex-col overflow-hidden"
        style={{ background: "var(--bg-base)" }}>

        {/* ── Header ── */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Avatar com gradiente e inicial */}
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-base sm:text-xl font-black shrink-0 select-none"
              style={{ background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #6366f1))", color: "#fff", boxShadow: "0 4px 16px var(--accent-bg)" }}>
              {compra.nome_cliente[0].toUpperCase()}
            </motion.div>
            <div>
              <p className="font-black text-base uppercase tracking-widest leading-tight" style={{ color: "var(--text-primary)" }}>{compra.nome_cliente}</p>
              <div className="flex items-center gap-2 mt-1">
                {compra.cor_sacola && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wide"
                    style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>{compra.cor_sacola}</span>
                )}
                {compra.numero_sacola && (
                  <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>#{compra.numero_sacola}</span>
                )}
                <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>·</span>
                <span className="text-xs font-black" style={{ color: "var(--text-secondary)" }}>{fmtBRL(compra.valor_total)}</span>
              </div>
            </div>
          </div>

          {/* Anel de progresso circular */}
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="relative hidden sm:flex items-center justify-center">
              <RingProgress pct={progresso} size={72}/>
              <div className="absolute flex flex-col items-center leading-none">
                <motion.span key={Math.round(progresso)}
                  initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="text-base font-black"
                  style={{ color: progresso >= 100 ? "#10b981" : "var(--text-primary)" }}>
                  {Math.round(progresso)}%
                </motion.span>
                <span className="text-[9px] font-black uppercase tracking-widest mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {totalVinculado}/{qtdEsperada}
                </span>
              </div>
              {showConfetti && <Confetti/>}
            </div>

            <motion.button onClick={onClose} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-muted)" }}>
              <X size={18}/>
            </motion.button>
          </div>
        </div>

        {/* ── Body: 2 colunas ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ─── Esquerda: produtos vinculados ─── */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: "1px solid var(--border)" }}>
            {/* Sub-header esquerdo */}
            <div className="px-8 py-4 shrink-0 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <PackageCheck size={13} style={{ color: "var(--accent)" }}/>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  PRODUTOS VINCULADOS
                </p>
                <motion.span key={(produtos ?? []).length}
                  initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                  {(produtos ?? []).length}
                </motion.span>
              </div>
              {/* Mini resumo de valor */}
              {(produtos ?? []).length > 0 && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
                  {fmtBRL((produtos ?? []).reduce((s, p) => s + (p.preco_live ?? p.preco_original ?? 0) * p.quantidade, 0))} vinculados
                </motion.span>
              )}
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto drawer-scroll px-6 py-5 space-y-2.5">
              <AnimatePresence initial={false}>
                {(produtos ?? []).map((p, i) => {
                  const disc = descPct(p.preco_original, p.preco_live)
                  return (
                    <motion.div key={p.id}
                      initial={{ opacity: 0, x: -20, scale: 0.96 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 20, scale: 0.94 }}
                      transition={{ delay: i * 0.03, type: "spring", stiffness: 360, damping: 28 }}
                      whileHover={{ x: 4, transition: { duration: 0.15 } }}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl group relative overflow-hidden"
                      style={{
                        background: p.estoque_baixado ? "rgba(16,185,129,0.05)" : "var(--bg-surface)",
                        border: `1.5px solid ${p.estoque_baixado ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
                      }}>
                      {/* Faixa lateral colorida */}
                      <motion.div animate={{ height: p.estoque_baixado ? "100%" : "0%" }}
                        className="absolute left-0 top-0 w-[3px] rounded-l-2xl"
                        style={{ background: p.estoque_baixado ? "#10b981" : "var(--accent)" }}
                        transition={{ duration: 0.4 }}/>

                      {/* Ícone */}
                      <motion.div
                        animate={p.estoque_baixado ? { rotate: [0, -8, 8, 0] } : {}}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: p.estoque_baixado ? "rgba(16,185,129,0.12)" : "var(--accent-bg)" }}>
                        {p.estoque_baixado
                          ? <CheckCircle2 size={17} style={{ color: "#10b981" }}/>
                          : <Package size={17} style={{ color: "var(--accent)" }}/>}
                      </motion.div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black uppercase tracking-wide truncate leading-tight"
                          style={{ color: "var(--text-primary)" }}>{p.nome_produto}</p>
                        {p.codigo_produto && <p className="text-[10px] font-mono mb-0.5" style={{ color: "var(--text-muted)" }}>{p.codigo_produto}</p>}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>{p.quantidade}x</span>
                          <span className="text-[12px] font-black" style={{ color: "var(--text-primary)" }}>
                            {fmtBRL(p.preco_live ?? p.preco_original ?? 0)}
                          </span>
                          {disc > 0 && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 16 }}
                              className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                              -{disc}%
                            </motion.span>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 shrink-0">
                        <AnimatePresence>
                          {p.estoque_baixado && (
                            <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                              className="text-[9px] font-black uppercase px-2 py-1 rounded-full tracking-wide"
                              style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                              ✓ ESTOQUE
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <motion.button onClick={() => remover(p.id)}
                          whileHover={{ scale: 1.15, rotate: 10 }} whileTap={{ scale: 0.85 }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                          style={{ color: "#f87171" }}>
                          <Trash2 size={13}/>
                        </motion.button>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {/* Empty state ilustrado */}
              {(produtos ?? []).length === 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="h-56 flex flex-col items-center justify-center gap-4 rounded-2xl"
                  style={{ border: "2px dashed var(--border)" }}>
                  <EmptyIllustration/>
                  <div className="text-center">
                    <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Nenhum produto vinculado
                    </p>
                    <p className="text-[10px] font-medium mt-1" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                      Busque e vincule produtos ao lado →
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Botão finalizar */}
            <AnimatePresence>
              {podeFinalizar && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className="px-8 pb-6 shrink-0 relative">
                  <motion.button onClick={finalizar} disabled={finalizando}
                    whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
                    animate={{ boxShadow: ["0 0 0px #10b98100","0 0 24px #10b98166","0 0 0px #10b98100"] }}
                    transition={{ boxShadow: { repeat: Infinity, duration: 2.2 } }}
                    className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-white relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                    <motion.div className="absolute inset-0"
                      animate={{ x: ["−100%","200%"] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)" }}/>
                    {finalizando ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
                    FINALIZAR COMPRA
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ─── Direita: formulário de vínculo ─── */}
          <div className="w-[480px] shrink-0 flex flex-col overflow-hidden" style={{ background: "var(--bg-card)" }}>
            {/* Sub-header direito */}
            <div className="px-8 py-4 shrink-0 flex items-center gap-2"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <Link2 size={13} style={{ color: "var(--accent)" }}/>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>VINCULAR PRODUTO</p>
            </div>

            <div className="flex-1 overflow-y-auto drawer-scroll px-8 py-6 space-y-4">
              {/* Busca com animação de borda */}
              <div className="relative">
                <motion.div animate={searchFocus ? { scale: 1.01 } : { scale: 1 }} transition={{ duration: 0.15 }}
                  className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10"
                    style={{ color: searchFocus ? "var(--accent)" : "var(--text-muted)", transition: "color 0.2s" }}/>
                  <input value={busca} onChange={e => buscarProdutos(e.target.value)}
                    onFocus={() => setSearchFocus(true)}
                    onBlur={() => setSearchFocus(false)}
                    placeholder="Buscar produto..."
                    className="w-full pl-10 pr-4 py-3.5 text-sm font-semibold rounded-xl outline-none transition-all"
                    style={{
                      background: "var(--bg-surface)",
                      border: `2px solid ${searchFocus ? "var(--accent)" : "var(--border)"}`,
                      color: "var(--text-primary)",
                      boxShadow: searchFocus ? "0 0 0 4px var(--accent-bg)" : "none",
                    }}/>
                </motion.div>
                {/* Dropdown de resultados */}
                <AnimatePresence>
                  {prodRes.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 right-0 mt-1.5 rounded-xl shadow-2xl z-10 overflow-hidden"
                      style={{ background: "var(--bg-card)", border: "1.5px solid var(--border)" }}>
                      {prodRes.map((p, i) => (
                        <motion.button key={p.id} onClick={() => selecionarProd(p)}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors hover:bg-[var(--bg-hover)] group"
                          style={{ borderBottom: i < prodRes.length - 1 ? "1px solid var(--border)" : "none" }}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: "var(--accent-bg)" }}>
                              <Package size={13} style={{ color: "var(--accent)" }}/>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-black uppercase tracking-wide truncate" style={{ color: "var(--text-primary)" }}>{p.nome.toUpperCase()}</span>
                              {p.codigo && <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{p.codigo}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>{fmtBRL(p.preco_venda ?? 0)}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-black uppercase"
                              style={{ background: (p.estoque_atual ?? 0) > 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.08)",
                                color: (p.estoque_atual ?? 0) > 0 ? "#10b981" : "#f87171" }}>
                              EST {p.estoque_atual ?? 0}
                            </span>
                          </div>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Card do produto selecionado */}
              <AnimatePresence>
                {form.nome_produto && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    className="rounded-2xl overflow-hidden"
                    style={{ border: "1.5px solid var(--accent)", background: "var(--accent-bg)" }}>
                    {/* Header do card */}
                    <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                      <motion.div initial={{ rotate: -15, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 16 }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "var(--accent)", boxShadow: "0 2px 8px var(--accent-bg)" }}>
                        <Package size={15} color="#fff"/>
                      </motion.div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-wide truncate"
                          style={{ color: "var(--accent)" }}>{form.nome_produto}</p>
                        {form.codigo_produto && <p className="text-[10px] font-mono" style={{ color: "var(--accent)", opacity: 0.65 }}>{form.codigo_produto}</p>}
                      </div>
                    </div>
                    <div className="px-4 pb-4 grid grid-cols-3 gap-2.5">
                      {/* QTD */}
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>QTD</p>
                        <input type="number" step="1" min="1" value={form.quantidade} placeholder="1"
                          onChange={e => setForm(prev => ({ ...prev, quantidade: e.target.value }))}
                          className="w-full px-3 py-2.5 text-sm font-bold rounded-xl outline-none border-2 transition-all focus:border-[color:var(--accent)] text-center"
                          style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
                      </div>
                      {/* Preço original */}
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>ORIGINAL</p>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black" style={{ color: "var(--text-muted)" }}>R$</span>
                          <input value={form.preco_original}
                            onChange={e => setForm(prev => ({ ...prev, preco_original: e.target.value }))}
                            onBlur={() => { const n = parseFloat(String(form.preco_original).replace(/\./g,"").replace(",",".")); if (!isNaN(n) && n > 0) setForm(prev => ({ ...prev, preco_original: n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) })) }}
                            placeholder="0,00"
                            className="w-full pl-8 pr-2 py-2.5 text-sm font-bold rounded-xl outline-none border-2 transition-all focus:border-[color:var(--accent)]"
                            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
                        </div>
                      </div>
                      {/* Preço live */}
                      <div>
                        <div className="flex items-center gap-1 mb-1.5">
                          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>LIVE</p>
                          <span className="text-[8px] font-black px-1 rounded" style={{ background: "var(--accent)", color: "#fff" }}>★</span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black" style={{ color: "var(--accent)" }}>R$</span>
                          <input value={form.preco_live}
                            onChange={e => setForm(prev => ({ ...prev, preco_live: e.target.value }))}
                            onBlur={() => { const n = parseFloat(String(form.preco_live).replace(/\./g,"").replace(",",".")); if (!isNaN(n) && n > 0) setForm(prev => ({ ...prev, preco_live: n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) })) }}
                            placeholder="0,00"
                            className="w-full pl-8 pr-2 py-2.5 text-sm font-bold rounded-xl outline-none border-2 transition-all focus:border-[color:var(--accent)]"
                            style={{ background: "var(--bg-surface)", borderColor: "var(--accent)", color: "var(--text-primary)" }}/>
                        </div>
                      </div>
                    </div>
                    {/* Linha de desconto calculado ao vivo */}
                    {(() => {
                      const orig = parseFloat(String(form.preco_original).replace(/\./g,"").replace(",",".")) || 0
                      const live = parseFloat(String(form.preco_live).replace(/\./g,"").replace(",",".")) || 0
                      const disc = descPct(orig, live)
                      if (!disc) return null
                      return (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                          className="px-4 pb-3">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                            <TrendingUp size={12} style={{ color: "#10b981" }}/>
                            <span className="text-[11px] font-black" style={{ color: "#10b981" }}>
                              Desconto de {disc}% · economia de {fmtBRL(orig - live)}
                            </span>
                          </div>
                        </motion.div>
                      )
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Erro */}
              <AnimatePresence>
                {erro && (
                  <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
                    style={{ background: "rgba(239,68,68,0.06)", border: "1.5px solid rgba(239,68,68,0.2)" }}>
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "#f87171" }}/>
                    <p className="text-xs font-semibold leading-snug" style={{ color: "#f87171" }}>{erro}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Botão vincular */}
            <div className="px-8 pb-6 shrink-0">
              <motion.button onClick={vincular} disabled={saving || !form.nome_produto}
                whileHover={form.nome_produto ? { scale: 1.02, y: -2 } : {}}
                whileTap={form.nome_produto ? { scale: 0.97 } : {}}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-white transition-all disabled:opacity-35 relative overflow-hidden"
                style={{ background: form.nome_produto ? "var(--accent)" : "var(--bg-surface)",
                  color: form.nome_produto ? "#fff" : "var(--text-muted)",
                  boxShadow: form.nome_produto ? "0 4px 20px var(--accent-bg)" : "none" }}>
                {saving
                  ? <Loader2 size={16} className="animate-spin"/>
                  : <motion.span animate={form.nome_produto ? { rotate: [0, -15, 15, 0] } : {}}
                      transition={{ duration: 0.5, delay: 0.1 }}>
                      <Link2 size={16}/>
                    </motion.span>
                }
                {saving ? "VINCULANDO..." : "VINCULAR PRODUTO"}
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
function ModalAvisoLive({ liveId, tipo, linkAtual, numeroEnvio, onClose, onSuccess }: {
  liveId: number; tipo: string; linkAtual: string; numeroEnvio: number
  onClose: () => void; onSuccess: (enviados: number, link: string) => void
}) {
  const [link, setLink] = useState(linkAtual)
  const [erro, setErro] = useState<string | null>(null)
  const iniciarAviso = useDisparoStore(s => s.iniciarAviso)
  const jobRodando   = useDisparoStore(s => s.job?.status === "running")

  const reenvio = numeroEnvio > 0

  // Mensagem varia se é o 1º disparo ou reenvio (live caiu e voltou)
  const previewMsg = reenvio
    ? tipo === "promocional"
      ? `⚡ Voltamos! A live caiu mas estamos DE VOLTA com PROMOÇÕES!\n\nNovo link de acesso: ${link || "[link]"}\n\nCorre que ainda dá tempo! 🔥`
      : `💫 Voltamos! A live caiu mas estamos DE VOLTA com NOVIDADES!\n\nNovo link de acesso: ${link || "[link]"}\n\nTe esperamos com muito amor! 💖`
    : tipo === "promocional"
      ? `🏷️ Estamos AO VIVO com PROMOÇÕES agora!\n\nAcesse aqui: ${link || "[link]"}\n\nCorre! 🔥`
      : `✨ Estamos AO VIVO com NOVIDADES agora!\n\nAcesse aqui: ${link || "[link]"}\n\nTe esperamos! 💖`

  // Enfileira o aviso no store e fecha o modal. O envio para todas as
  // clientes roda em SEGUNDO PLANO (widget flutuante no canto), com
  // intervalo seguro entre cada mensagem.
  function disparar() {
    if (!link.trim()) { setErro("Cole o link da live primeiro."); return }
    const ok = iniciarAviso({
      liveId,
      liveTitulo: reenvio ? "Reenvio de aviso da live" : "Aviso da live",
      link: link.trim(),
    })
    if (!ok) { setErro("Já há um envio em andamento. Aguarde terminar."); return }
    onSuccess(-1, link.trim())   // -1 = envio em segundo plano (contagem no widget)
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        {/* Header — muda cor e título se for reenvio */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)", background: reenvio ? "rgba(225,29,72,0.06)" : "transparent" }}>
          <span className="font-bold text-sm inline-flex items-center gap-2"
            style={{ color: reenvio ? "#e11d48" : "#10b981" }}>
            {reenvio ? <><RefreshCw size={15}/> Live caiu? Enviando de volta! 🔴</> : <><Radio size={16}/> Avisar Clientes da Live</>}
          </span>
          <button onClick={onClose}><X size={18} style={{ color: "var(--text-muted)" }} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Badge de reenvio */}
          {reenvio && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(225,29,72,0.08)", border: "1px solid rgba(225,29,72,0.25)", color: "#e11d48" }}>
              <AlertCircle size={13}/>
              Reenvio #{numeroEnvio + 1} — a mensagem já informa que a live voltou após queda.
            </div>
          )}

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {reenvio
              ? "Cole o novo link da live. A mensagem já será diferente — as clientes saberão que a live voltou."
              : <>Envia para todas as clientes com consentimento de <b>avisos de lives</b> confirmado. Tipo: <b>{tipo === "promocional" ? "Promocional 🏷️" : "Novidades ✨"}</b>.</>}
          </p>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {reenvio ? "Novo link da live (Instagram/TikTok)" : "Link da live (Instagram/TikTok)"}
            </label>
            <input value={link} onChange={e => setLink(e.target.value)} autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-base)", border: `1px solid ${reenvio ? "rgba(225,29,72,0.4)" : "var(--border)"}`, color: "var(--text-primary)" }}
              placeholder="https://instagram.com/..." />
          </div>

          {/* Preview da mensagem */}
          <div className="rounded-lg p-3 text-xs whitespace-pre-line"
            style={{ background: reenvio ? "rgba(225,29,72,0.05)" : "var(--bg-base)", color: "var(--text-secondary)", border: `1px solid ${reenvio ? "rgba(225,29,72,0.15)" : "transparent"}` }}>
            {previewMsg}
          </div>

          {erro && (
            <p className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400">{erro}</p>
          )}

          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            O envio roda em segundo plano — acompanhe pelo widget no canto inferior direito.
          </p>

          <button onClick={disparar} disabled={jobRodando}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: reenvio ? "#e11d48" : "#10b981" }}>
            {reenvio ? <RefreshCw size={15}/> : <Send size={15}/>}
            {jobRodando ? "Envio em andamento…" : reenvio ? "Reenviar — Estamos de Volta!" : "Disparar Aviso Agora"}
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
  const [msgResult, setMsgResult] = useState<MessageResult | null>(null)
  const [stIdx, setStIdx]       = useState<number>(() => selectSmallTalkIndex())
  const [parcOpen, setParcOpen] = useState(false)
  const iniciarDisparo = useDisparoStore(s => s.iniciarDisparo)
  const jobRodando     = useDisparoStore(s => s.job?.status === "running")

  const pendentes = compras.filter(c => !c.msg_status || c.msg_status === "pendente" || c.msg_status === "erro")
  const [exLink, setExLink] = useState<string | null>(null)
  const [gerandoLink, setGerandoLink] = useState(false)
  const [erroLink, setErroLink] = useState(false)
  const [erroLinkMsg, setErroLinkMsg] = useState<string | null>(null)
  const ex = pendentes[0]

  // Calcula valor final do primeiro pendente para detectar pagamento por crédito
  const creditoEx = parseFloat(String(ex?.credito_aplicado ?? 0))
  const valorTotalEx = parseFloat(String(ex?.valor_total ?? 0))
  const valorFinalEx0 = Math.max(0, valorTotalEx - parseFloat(String(ex?.desconto ?? 0)) - creditoEx)
  const pagoCreditoEx = valorFinalEx0 === 0 && creditoEx > 0

  function gerarLink() {
    if (!ex || pagoCreditoEx) return
    setErroLink(false)
    setErroLinkMsg(null)
    setGerandoLink(true)
    apiPost<{ id: number; link_pagamento?: string | null; erro?: string }>(`/live/${liveId}/disparar`, { compra_id: ex.id, apenas_link: true })
      .then(r => {
        if (r?.link_pagamento) setExLink(r.link_pagamento)
        else { setErroLink(true); setErroLinkMsg(r?.erro ?? null) }
      })
      .catch(() => setErroLink(true))
      .finally(() => setGerandoLink(false))
  }

  // Pré-gera o link Asaas quando o modal abre e a compra não tem link ainda
  useEffect(() => {
    if (!ex) return
    if (pagoCreditoEx) { setExLink(null); return }
    if (ex.link_pagamento) { setExLink(ex.link_pagamento); return }
    gerarLink()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex?.id, liveId])

  // Gera preview sempre que a compra, o link, o índice de small talk ou o estado mudarem
  useEffect(() => {
    if (!ex) { setMsgResult(null); return }
    const compraData: CompraData = {
      data_compra:      liveData,
      data_live:        liveData,
      numero_sacola:    ex.numero_sacola,
      cor_sacola:       ex.cor_sacola,
      quantidade_itens: ex.quantidade_itens,
      valor_total:      ex.valor_total,
      nome_cliente:     ex.nome_cliente,
      credito_aplicado: ex.credito_aplicado,
      pago_com_credito: pagoCreditoEx,
      link_pagamento: pagoCreditoEx
        ? null
        : exLink ?? ex.link_pagamento ?? (gerandoLink ? undefined : null),
    }
    setMsgResult(buildCompleteMessage(compraData, stIdx))
  }, [ex, liveData, exLink, gerandoLink, pagoCreditoEx, stIdx])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn); return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  function gerarNovaVariacao() { setStIdx(selectSmallTalkIndex()) }

  async function copiarMensagem() {
    if (msgResult) await navigator.clipboard.writeText(msgResult.mensagem)
  }

  // Enfileira o disparo no store global e fecha o modal. O envio roda em
  // segundo plano (widget flutuante no canto), com intervalo seguro entre
  // cada mensagem — o operador continua usando o sistema normalmente.
  function disparar() {
    if (!msgResult?.valida) return
    const ok = iniciarDisparo({ liveId, liveTitulo })
    if (!ok) return   // já há um envio em andamento
    onSuccess()
    onClose()
  }

  // Cores do contador
  const charColor = () => {
    if (!msgResult) return "var(--text-muted)"
    if (msgResult.chars > CHAR_LIMIT) return "#f87171"
    if (msgResult.chars > CHAR_TARGET) return "#fb923c"
    if (msgResult.chars > 900) return "#fbbf24"
    return "var(--text-muted)"
  }

  const levelLabel: Record<string, string> = {
    COMPLETO: "Intro completa", MEDIO: "Intro média",
    CURTO: "Intro curta", FALLBACK: "Intro mínima",
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

  const podeEnviar = !!pendentes.length && !!msgResult?.valida && !gerandoLink && !erroLink && !jobRodando

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-x-0 bottom-0 z-[15] flex flex-col"
      style={{ top: "var(--topbar-height, 52px)", background: "var(--bg-base)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: COR_LIVE }}>Disparar Mensagens</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}>
            {pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>
          <X size={15}/> Cancelar
        </button>
      </div>

      {/* Preview */}
      {(
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
          <div className="flex-1 flex flex-col min-w-0">
            {/* Barra do contato */}
            <div className="px-4 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                <p className="text-xs font-bold text-white">B</p>
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Brechó Bellasu</p>
            </div>

            {/* Balão WhatsApp */}
            <div className="flex-1 overflow-y-auto p-4" style={{ background: "#0b141a" }}>
              {ex && msgResult ? (
                <div className="flex justify-end mb-2">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg" style={{ background: "#005c4b" }}>
                    <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#e9edef" }}>
                      <WhatsAppText text={msgResult.mensagem}/>
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

            {/* Badge compacto de parcelamento — usa valor FINAL (após crédito/desconto) */}
            {ex && (() => {
              const valorFinalEx = calcularValorFinal(ex.valor_total ?? 0, ex.desconto, ex.credito_aplicado)
              const regra = regraParcelamento(valorFinalEx)
              const cor = corRegraParcelamento(regra.maxSemJuros)
              const emoji = regra.maxSemJuros === 0 ? "🔴" : regra.maxSemJuros === 2 ? "🟡" : "🟢"
              const temDesconto = (ex.desconto ?? 0) > 0
              const temCredito  = (ex.credito_aplicado ?? 0) > 0
              const temAbatimento = temDesconto || temCredito
              return (
                <div className="shrink-0 relative px-4 py-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <button
                    onClick={() => setParcOpen(v => !v)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all"
                    style={{ background: `${cor}18`, border: `1px solid ${cor}44`, color: cor }}
                  >
                    {regra.maxSemJuros === 0 && (
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ background: cor }}
                      />
                    )}
                    <span>💳 {regra.label}</span>
                    {temAbatimento && <span className="opacity-60 text-[9px]">(valor final)</span>}
                    <span style={{ opacity: 0.6 }}>{parcOpen ? "▲" : "▼"}</span>
                  </button>

                  <AnimatePresence>
                    {parcOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="absolute bottom-full left-4 mb-2 z-30 rounded-xl p-3 space-y-2.5 w-80 shadow-2xl"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                      >
                        {/* Resumo de valor desta compra */}
                        <div className="space-y-1 px-2.5 py-2 rounded-lg text-[11px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                          <div className="flex justify-between">
                            <span style={{ color: "var(--text-muted)" }}>Valor original</span>
                            <span style={{ color: "var(--text-primary)" }}>{fmtBRL(ex.valor_total ?? 0)}</span>
                          </div>
                          {temDesconto && (
                            <div className="flex justify-between">
                              <span style={{ color: "var(--text-muted)" }}>Desconto</span>
                              <span style={{ color: "#f87171" }}>− {fmtBRL(ex.desconto ?? 0)}</span>
                            </div>
                          )}
                          {temCredito && (
                            <div className="flex justify-between">
                              <span style={{ color: "var(--text-muted)" }}>🎁 Crédito aplicado</span>
                              <span style={{ color: "#34d399" }}>− {fmtBRL(ex.credito_aplicado ?? 0)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                            <span style={{ color: "var(--text-primary)" }}>Valor final a pagar</span>
                            <span style={{ color: valorFinalEx === 0 ? "#34d399" : cor }}>{fmtBRL(valorFinalEx)}</span>
                          </div>
                        </div>

                        {/* Regra aplicada ao valor final */}
                        {valorFinalEx === 0 ? (
                          <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.3)" }}>
                            <span>✅</span>
                            <div>
                              <p className="text-[11px] font-bold" style={{ color: "#34d399" }}>Pago com crédito</p>
                              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Nenhum link Asaas será gerado.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ background: `${cor}10`, border: `1px solid ${cor}30` }}>
                            <span>{emoji}</span>
                            <div>
                              <p className="text-[11px] font-bold" style={{ color: cor }}>{fmtBRL(valorFinalEx)} → {regra.label}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{regra.avisoSemJuros}</p>
                              {regra.avisoComJuros && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{regra.avisoComJuros}</p>}
                            </div>
                          </div>
                        )}

                        {/* Tabela de faixas */}
                        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                          {[
                            { label: "Até R$ 149", sub: "Sem 2x s/ juros", cor: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
                            { label: "R$ 150–299", sub: "Até 2x s/ juros", cor: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)" },
                            { label: "R$ 300+",    sub: "Até 3x s/ juros", cor: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
                          ].map(f => (
                            <div key={f.label} className="px-2 py-1.5 rounded-lg text-center" style={{ background: f.bg, border: `1px solid ${f.border}` }}>
                              <p className="font-bold" style={{ color: f.cor }}>{f.label}</p>
                              <p style={{ color: "var(--text-muted)" }}>{f.sub}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          ⚠️ A partir de 4x os juros são sempre repassados à cliente. A regra considera o valor final a pagar.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })()}

            {/* Barra de status da mensagem */}
            {msgResult && (
              <div className="px-4 py-2.5 shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1"
                style={{ borderTop: "1px solid var(--border)" }}>
                {/* Contador de chars */}
                <span className="text-[11px] font-mono font-semibold" style={{ color: charColor() }}>
                  {msgResult.chars}/{CHAR_LIMIT} chars
                  {msgResult.chars > CHAR_LIMIT && " ⚠️ ACIMA DO LIMITE"}
                  {msgResult.chars > CHAR_TARGET && msgResult.chars <= CHAR_LIMIT && " ⚠️ próximo do limite"}
                </span>
                {/* Bytes */}
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  ~{msgResult.bytes} bytes UTF-8
                </span>
                {/* Nível */}
                <span className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                  {levelLabel[msgResult.level] ?? msgResult.level}
                </span>
                {/* Status validação */}
                {msgResult.valida
                  ? <span className="text-[11px] text-emerald-400">✓ Válida</span>
                  : <span className="text-[11px] text-red-400">✗ {msgResult.erro}</span>}
                {/* Indicador Asaas */}
                {!ex?.link_pagamento && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}>
                    💳 Link Asaas gerado no envio
                  </motion.span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer de ações */}
      {(
        <div className="shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Aviso de erro ao gerar link Asaas */}
          {erroLink && !pagoCreditoEx && (
            <div className="flex items-center justify-between gap-3 px-6 py-2.5" style={{ background: "rgba(248,113,113,0.08)", borderBottom: "1px solid rgba(248,113,113,0.2)" }}>
              <p className="text-xs" style={{ color: "#f87171" }}>
                ⚠️ {erroLinkMsg ?? "Não foi possível gerar o link de pagamento. A compra permanece pendente."}
              </p>
              <button onClick={gerarLink} disabled={gerandoLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shrink-0 disabled:opacity-50"
                style={{ borderColor: "#f87171", color: "#f87171", background: "rgba(248,113,113,0.08)" }}>
                <RefreshCw size={11}/> Tentar novamente
              </button>
            </div>
          )}
          {/* Gerando link */}
          {gerandoLink && (
            <div className="px-6 py-2 flex items-center gap-2" style={{ background: "rgba(99,102,241,0.06)", borderBottom: "1px solid rgba(99,102,241,0.15)" }}>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                <RefreshCw size={11} style={{ color: "#818cf8" }}/>
              </motion.div>
              <p className="text-xs" style={{ color: "#818cf8" }}>Gerando link de pagamento Asaas…</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2">
              <button onClick={gerarNovaVariacao}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-surface)" }}>
                <RefreshCw size={12}/> Outra variação
              </button>
              <button onClick={copiarMensagem} disabled={!msgResult}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-surface)" }}>
                <Check size={12}/> Copiar
              </button>
            </div>

            <div className="flex items-center gap-3">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {pendentes.length} msg{pendentes.length !== 1 ? "s" : ""} será{pendentes.length !== 1 ? "ão" : ""} enviada{pendentes.length !== 1 ? "s" : ""}
              </p>
              <motion.button onClick={disparar} disabled={!podeEnviar} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white shadow-lg disabled:opacity-40"
                style={{ background: podeEnviar ? "#25d366" : "var(--bg-surface)" }}>
                <Send size={15}/> Disparar Agora
              </motion.button>
            </div>
          </div>
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
  const [modalFoto, setModalFoto]       = useState(false)
  const [modalDisparar, setModalDisp]   = useState(false)
  const [modalAviso, setModalAviso]     = useState(false)
  const [modalVinculo, setModalVinculo] = useState<Compra | null>(null)
  const [erroEnc, setErroEnc] = useState("")
  const [encerrando, setEnc]  = useState(false)
  const [excluindo, setExc]   = useState(false)
  const [editCompra, setEditCompra] = useState<Compra | null>(null)
  const [excluindoCompraId, setExcluindoCompraId] = useState<number | null>(null)
  const [confirmExcluirCompra, setConfirmExcluirCompra] = useState<number | null>(null)
  const [retirandoId, setRetirandoId] = useState<number | null>(null)
  const [retiradaAnimId, setRetiradaAnimId] = useState<number | null>(null)
  const [erroRetirada, setErroRetirada] = useState("")
  const [desfazendoId, setDesfazendoId] = useState<number | null>(null)
  // Histórico de avisos enviados durante esta sessão
  const [historicoAvisos, setHistoricoAvisos] = useState<{ hora: string; enviados: number; link: string }[]>([])

  const [marcandoPagoId, setMarcandoPagoId] = useState<number | null>(null)
  async function marcarPago(compraId: number) {
    setMarcandoPagoId(compraId)
    try {
      await apiPatch(`/live/${liveId}/compras/${compraId}`, { pagamento_status: "PAGO" })
      refetch(); qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] })
    } catch { /* silencia */ }
    finally { setMarcandoPagoId(null) }
  }

  async function desfazerRetirada(compraId: number) {
    setDesfazendoId(compraId); setErroRetirada("")
    try {
      await apiDelete(`/live/${liveId}/compras/${compraId}/retirar`)
      refetch(); qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] })
    } catch (e: unknown) {
      setErroRetirada(e instanceof Error ? e.message : "Erro ao desfazer retirada.")
    } finally { setDesfazendoId(null) }
  }

  async function confirmarRetirada(compraId: number) {
    setRetirandoId(compraId); setErroRetirada("")
    try {
      await apiPost(`/live/${liveId}/compras/${compraId}/retirar`, {})
      setRetiradaAnimId(compraId)
      setTimeout(() => setRetiradaAnimId(null), 1800)
      refetch(); qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] })
    } catch (e: unknown) {
      setErroRetirada(e instanceof Error ? e.message : "Erro ao confirmar retirada.")
    } finally { setRetirandoId(null) }
  }

  async function excluirCompra(compraId: number) {
    setExcluindoCompraId(compraId)
    try {
      await apiDelete(`/live/${liveId}/compras/${compraId}`)
      qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] })
    } catch { /* silencia */ }
    finally { setExcluindoCompraId(null); setConfirmExcluirCompra(null) }
  }

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
  const compras = (live.compras ?? []).slice().sort((a, b) => a.nome_cliente.localeCompare(b.nome_cliente, "pt-BR"))
  const etapa = calcEtapa(live)
  const statusCfg = STATUS_LIVE[live.status ?? "aberta"] ?? STATUS_LIVE.aberta

  // Métricas
  const totalClientes  = compras.length
  const totalArrecadado = compras.reduce((s, c) => s + c.valor_total, 0)
  const msgEnviadas    = compras.filter(c => c.msg_status === "enviada").length
  const msgPendentes   = compras.filter(c => !c.msg_status || c.msg_status === "pendente" || c.msg_status === "erro").length
  const aguardVinculo  = compras.filter(c => c.status_compra === "aguardando_vinculo" || c.status_compra === "vinculo_parcial").length
  const finalizadas    = compras.filter(c => c.status_compra === "finalizada" || c.status_compra === "retirada").length
  const retiradas      = compras.filter(c => c.status_compra === "retirada").length
  const aguardRetirada = compras.filter(c => c.status_compra === "finalizada").length

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

  const podeEncerrar = live.status !== "encerrada" && compras.length > 0 && compras.every(c => c.status_compra === "finalizada" || c.status_compra === "retirada")

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
              {live.titulo ?? fmtData(live.data_live ?? "")}
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
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide whitespace-nowrap shrink-0"
                style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                <Plus size={14}/> Adicionar Compra
              </motion.button>

              <motion.button onClick={() => setModalFoto(true)}
                whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide whitespace-nowrap shrink-0"
                style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid transparent" }}
                title="Tire uma foto do caderno e o sistema identifica as compras automaticamente">
                <CameraIcon size={14}/> Importar Foto
              </motion.button>

              {msgPendentes > 0 && (
                <motion.button onClick={() => setModalDisp(true)}
                  whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                  animate={{ boxShadow: ["0 0 0px #25d36600","0 0 18px #25d36655","0 0 0px #25d36600"] }}
                  transition={{ boxShadow: { repeat: Infinity, duration: 2.2 }, scale: {}, y: {} }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide text-white whitespace-nowrap shrink-0"
                  style={{ background: "linear-gradient(135deg, #25d366, #128c7e)" }}>
                  <Send size={14}/> Disparar Mensagens
                </motion.button>
              )}

              <span className="w-px h-6 mx-1 shrink-0" style={{ background: "var(--border)" }}/>

              <motion.button onClick={podeEncerrar ? encerrar : undefined} disabled={encerrando}
                whileHover={podeEncerrar ? { scale: 1.03, y: -1 } : {}}
                whileTap={podeEncerrar ? { scale: 0.97 } : { x: [-3,3,-3,0] }}
                transition={podeEncerrar ? {} : { duration: 0.25 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition-all whitespace-nowrap shrink-0"
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition-opacity whitespace-nowrap shrink-0"
                style={{ color: COR_LIVE, opacity: excluindo ? 0.5 : 1 }}>
                <Trash2 size={13}/> {excluindo ? "Excluindo..." : "Excluir"}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>

      {/* ══ MÉTRICAS ══ */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 px-4 sm:px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
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

      {/* ══ CARD AVISOS DE LIVE ══ */}
      {live.status === "aberta" && (
        <div className="px-6 pb-3">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
                  <span className="text-xs font-black uppercase tracking-widest" style={{ color: "#10b981" }}>
                    {historicoAvisos.length === 0 ? "Avisar clientes da live" : `Live caiu? Reenvie o aviso`}
                  </span>
                </div>
                {historicoAvisos.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                    {historicoAvisos.length}x enviado{historicoAvisos.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button onClick={() => setModalAviso(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide text-white shrink-0"
                style={{ background: historicoAvisos.length > 0 ? "#e11d48" : "#10b981" }}>
                {historicoAvisos.length > 0
                  ? <><RefreshCw size={13}/> Reenviar com novo link</>
                  : <><Radio size={13}/> Enviar aviso agora</>}
              </button>
            </div>

            {/* Histórico de disparos desta sessão */}
            {historicoAvisos.length > 0 && (
              <div className="mt-3 space-y-1">
                {historicoAvisos.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <span className="font-bold tabular-nums" style={{ color: "#10b981" }}>#{i + 1}</span>
                    <span>{h.hora}</span>
                    <span>→</span>
                    <span>{h.enviados < 0
                      ? "envio em segundo plano"
                      : `${h.enviados} cliente${h.enviados !== 1 ? "s" : ""} notificada${h.enviados !== 1 ? "s" : ""}`}</span>
                    <span className="truncate max-w-[200px] opacity-60">{h.link}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ══ TABELA COMPRAS ══ */}
      <div className="flex-1 flex flex-col overflow-hidden px-6 py-4">

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            COMPRAS DESTA LIVE
          </p>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-auto rounded-2xl" style={{ border: "1px solid var(--border)" }}>
          {compras.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center gap-3 py-20">
              <ShoppingBag size={36} className="opacity-20" style={{ color: "var(--text-muted)" }}/>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>NENHUMA COMPRA AINDA</p>
            </motion.div>
          ) : (
            <table className="w-full min-w-[700px]">
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
                    const podeVincular = live.status !== "encerrada" && c.status_compra !== "retirada"

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
                          {c.whatsapp ? (
                            <a
                              href={`https://wa.me/55${c.whatsapp.replace(/\D/g, "")}`}
                              target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                              style={{ color: "#25d366" }}>
                              <MessageCircle size={12} />{c.whatsapp}
                            </a>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                          )}
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
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            {c.pagamento_status !== "PAGO" && c.valor_total > 0 && (
                              <motion.button
                                onClick={() => marcarPago(c.id)}
                                disabled={marcandoPagoId === c.id}
                                whileHover={{ scale: 1.06, y: -1 }} whileTap={{ scale: 0.94 }}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg"
                                style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                                {marcandoPagoId === c.id ? <Loader2 size={10} className="animate-spin"/> : <CheckCircle2 size={10}/>}
                                {marcandoPagoId === c.id ? "..." : "PAGO"}
                              </motion.button>
                            )}
                          {live.status !== "encerrada" && c.status_compra !== "finalizada" && (
                              <motion.button onClick={() => setEditCompra(c)}
                                whileHover={{ scale: 1.06, y: -1 }} whileTap={{ scale: 0.94 }}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg"
                                style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}>
                                <Pencil size={10}/> EDITAR
                              </motion.button>
                            )}
                            {podeVincular && (
                              <motion.button onClick={() => setModalVinculo(c)}
                                whileHover={{ scale: 1.06, y: -1 }} whileTap={{ scale: 0.94 }}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg"
                                style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                                <Link2 size={10}/> VINCULAR
                              </motion.button>
                            )}
                            {c.status_compra === "finalizada" && (
                              <motion.button
                                onClick={() => confirmarRetirada(c.id)}
                                disabled={retirandoId === c.id}
                                whileHover={{ scale: 1.06, y: -1 }}
                                whileTap={{ scale: 0.94 }}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg"
                                style={{ background: "rgba(99,153,34,0.12)", color: "#3b6d11", border: "1px solid rgba(99,153,34,0.35)" }}>
                                {retirandoId === c.id
                                  ? <Loader2 size={10} className="animate-spin"/>
                                  : <ShoppingBag size={10}/>}
                                {retirandoId === c.id ? "..." : "RETIRADA"}
                              </motion.button>
                            )}
                            {c.status_compra === "retirada" && (
                              <div className="inline-flex items-center gap-1.5">
                                <motion.div
                                  key={`retirada-${c.id}`}
                                  initial={retiradaAnimId === c.id ? { scale: 0.3, opacity: 0 } : { scale: 1, opacity: 1 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ type: "spring", stiffness: 520, damping: 16 }}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg"
                                  style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                                  <motion.div
                                    initial={retiradaAnimId === c.id ? { rotate: -30, scale: 0 } : { rotate: 0, scale: 1 }}
                                    animate={{ rotate: 0, scale: 1 }}
                                    transition={{ type: "spring", stiffness: 600, damping: 14, delay: 0.08 }}>
                                    <CheckCircle2 size={12} style={{ color: "#10b981" }}/>
                                  </motion.div>
                                  RETIRADA
                                </motion.div>
                                <motion.button
                                  onClick={() => desfazerRetirada(c.id)}
                                  disabled={desfazendoId === c.id}
                                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                                  className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1.5 rounded-lg"
                                  style={{ background: "rgba(107,114,128,0.1)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                                  {desfazendoId === c.id ? <Loader2 size={9} className="animate-spin"/> : <X size={9}/>}
                                </motion.button>
                              </div>
                            )}
                            {/* Botão excluir compra */}
                            {live.status !== "encerrada" && (
                              confirmExcluirCompra === c.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => excluirCompra(c.id)}
                                    disabled={excluindoCompraId === c.id}
                                    className="text-[10px] font-black uppercase px-2 py-1 rounded-lg disabled:opacity-50"
                                    style={{ background: "#ef4444", color: "#fff" }}>
                                    {excluindoCompraId === c.id ? "..." : "Sim"}
                                  </button>
                                  <button onClick={() => setConfirmExcluirCompra(null)}
                                    className="text-[10px] font-black uppercase px-2 py-1 rounded-lg"
                                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <motion.button onClick={() => setConfirmExcluirCompra(c.id)}
                                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                                  className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg"
                                  style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                                  <Trash2 size={10}/> EXCLUIR
                                </motion.button>
                              )
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
          {erroRetirada && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-2 px-4 py-2.5 rounded-xl flex items-center gap-2"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle size={13} style={{ color: "#f87171" }}/>
              <p className="text-xs font-semibold" style={{ color: "#f87171" }}>Retirada: {erroRetirada}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modais */}
      <AnimatePresence>
        {modalCompra   && <WizardCompra  liveId={liveId} liveData={live.data_live ?? ""} onClose={() => setModalCompra(false)}  onSalvo={() => { refetch(); qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] }) }}/>}
        {modalFoto     && <ImportarPorFoto liveId={liveId} liveData={live.data_live ?? ""} onClose={() => setModalFoto(false)} onSalvo={() => { refetch(); qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] }) }}/>}
        {modalDisparar && <ModalDisparar liveId={liveId} liveTitulo={live.titulo ?? ""} liveData={live.data_live ?? ""} compras={compras} onClose={() => setModalDisp(false)} onSuccess={() => { setModalDisp(false); qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] }); setTimeout(() => refetch(), 800) }}/>}

      {modalAviso && <ModalAvisoLive liveId={liveId} tipo={live.tipo ?? "novidades"} linkAtual={historicoAvisos.length > 0 ? historicoAvisos[historicoAvisos.length - 1].link : (live.link_live ?? "")} numeroEnvio={historicoAvisos.length} onClose={() => setModalAviso(false)} onSuccess={(enviados, link) => {
        const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        setHistoricoAvisos(prev => [...prev, { hora, enviados, link }])
        setModalAviso(false)
        qc.invalidateQueries({ queryKey: ["live-detalhe", liveId] }); refetch()
      }}/>}
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
  const [wizard, setWizard]           = useState(false)
  const [liveAberta, setAberta]       = useState<number | null>(null)
  const [statusFiltro, setStatus]     = useState("")
  const [consultaAberta, setConsulta] = useState(false)

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
    <div className="space-y-5 pt-3 sm:pt-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>Live</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{data?.total ?? 0} lives</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button onClick={() => setConsulta(true)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 sm:gap-2 text-sm font-semibold px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <ShoppingBag size={15}/> <span className="hidden sm:inline">Consultar Sacola</span>
          </motion.button>
          <motion.button onClick={() => setWizard(true)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 sm:gap-2 text-sm font-semibold px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-white shadow-lg"
            style={{ background: COR_LIVE }}>
            <Radio size={15}/> <span className="hidden sm:inline">Nova Live</span>
          </motion.button>
        </div>
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
          <table className="w-full min-w-[560px]">
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

      {/* Wizard fullscreen — Consultar Sacola da Cliente */}
      <AnimatePresence>
        {consultaAberta && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex flex-col"
            style={{ background: "var(--bg-base)" }}>

            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--accent-bg)" }}>
                  <ShoppingBag size={16} style={{ color: "var(--accent)" }}/>
                </div>
                <div>
                  <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Consultar Sacola da Cliente</span>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Busque por nome, WhatsApp, Instagram, apelido ou nº da sacola</p>
                </div>
              </div>
              <motion.button onClick={() => setConsulta(false)}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                <X size={15}/> Fechar
              </motion.button>
            </div>

            {/* Conteúdo fullscreen */}
            <div className="flex-1 min-h-0 flex flex-col">
              <BuscaClienteGlobal fullscreen onAbrirLive={id => { setConsulta(false); setAberta(id) }}/>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {wizard && <WizardLive onClose={() => setWizard(false)} onSalvo={id => { setWizard(false); setAberta(id) }}/>}
      </AnimatePresence>
    </div>
  )
}
