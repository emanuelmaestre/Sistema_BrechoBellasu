"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import {
  Plus, Loader2, Check, Trash2,
  X, ChevronLeft, ArrowRight, Wallet, TrendingDown, TrendingUp,
  AlertTriangle, Send,
} from "lucide-react"
import { apiGet, apiPost, apiPatch, apiDelete } from "@/services/api"
import { SuccessOverlay } from "@/components/SuccessOverlay"
import DatePicker from "@/components/DatePicker"
import { fmtBRL, fmtData, cn } from "@/lib/utils"
import { useTableKeyNav } from "@/hooks/useKeyNav"

// ─── Tipos ────────────────────────────────────────────────
type Conta = {
  id: number; descricao: string; valor: number; vencimento: string
  status: string; categoria?: string; credor?: string; cliente_nome?: string
}
type Resumo = { saldo_caixa?: number; total_pagar?: number; total_receber?: number; entradas_mes?: number; saidas_mes?: number }
type Tab = "pagar" | "receber"

interface ContaForm {
  descricao: string
  valor: string
  vencimento: string
  categoria: string
  parte: string   // credor (pagar) ou id_cliente (receber)
}

const EMPTY: ContaForm = { descricao: "", valor: "", vencimento: "", categoria: "", parte: "" }

// ─── Animação ─────────────────────────────────────────────
const variants = {
  enter:  (d: number) => ({ x: d > 0 ?  60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: d > 0 ? -60 :  60, opacity: 0 }),
}

// ─── Wizard ───────────────────────────────────────────────
function WizardConta({ onClose, onSalvo }: { onClose: () => void; onSalvo: () => void }) {
  const qc = useQueryClient()
  const [tipo, setTipo]   = useState<Tab | null>(null)
  const [step, setStep]   = useState(1)
  const [dir, setDir]     = useState(1)
  const [form, setForm]   = useState<ContaForm>(EMPTY)
  const [erro, setErro]   = useState("")
  const [saving, setSaving] = useState(false)
  const [salvoOk, setSalvoOk] = useState(false)
  const [valorFormatado, setValorFormatado] = useState("")
  const [returnToRevisao, setReturnToRevisao] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const TOTAL = 5

  const isPagar = tipo === "pagar"
  const cor = tipo === "pagar" ? "#f59e0b" : tipo === "receber" ? "#10b981" : "var(--accent)"

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 280)
    return () => clearTimeout(t)
  }, [step])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  function set(k: keyof ContaForm, v: string) { setForm(f => ({ ...f, [k]: v })); setErro("") }

  function go(next: number) { setDir(next > step ? 1 : -1); setStep(next); setErro("") }

  function advance() {
    if (step === 1 && !form.descricao.trim()) { setErro("Descrição é obrigatória"); return }
    if (step === 2 && (!form.valor || Number(form.valor) <= 0)) { setErro("Informe um valor válido"); return }
    if (step === 3 && !form.vencimento) { setErro("Vencimento é obrigatório"); return }
    if (returnToRevisao) { setReturnToRevisao(false); go(TOTAL); return }
    if (step < TOTAL) go(step + 1)
  }

  async function handleSalvar() {
    setSaving(true); setErro("")
    try {
      await apiPost(`/financeiro/${tipo}`, {
        descricao:  form.descricao.trim(),
        valor:      Number(form.valor),
        vencimento: form.vencimento,
        categoria:  isPagar ? (form.categoria || null) : undefined,
        ...(isPagar ? {} : { cliente_id: form.parte ? Number(form.parte) : null }),
      })
      qc.invalidateQueries({ queryKey: ["financeiro"] })
      setSalvoOk(true)
      setTimeout(() => { setSalvoOk(false); onSalvo() }, 2200)
    } catch (err: unknown) {
      setErro((err as Error).message || "Erro ao salvar. Tente novamente.")
    }
    finally { setSaving(false) }
  }

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step === TOTAL) { e.preventDefault(); handleSalvar(); return }
    if (e.key === "Enter" && step < TOTAL) { e.preventDefault(); advance() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, returnToRevisao])

  const iBase = "w-full px-5 py-4 text-lg rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }

  // Tela de seleção de tipo — mesmo padrão do wizard de trocas
  if (!tipo) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>Brechó Bellasu</span>
            <span style={{ color: "var(--border-hover)" }}>|</span>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Nova Conta</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>1 / {TOTAL}</span>
            <button onClick={onClose}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
              <X size={15} /> Cancelar
            </button>
          </div>
        </div>

        {/* Conteúdo — layout idêntico ao step 1 do trocas */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base font-bold" style={{ color: "var(--accent)" }}>1</span>
              <ArrowRight size={14} style={{ color: "var(--accent)" }} />
            </div>

            <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              O que você quer lançar?
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
              Selecione o tipo de lançamento financeiro.
            </p>

            <div className="flex gap-4">
              {[
                {
                  value: "pagar"   as Tab,
                  label: "A Pagar",
                  icon:  <TrendingDown size={32} />,
                  desc:  "Registrar uma saída ou despesa",
                  cor:   "#f59e0b",
                  bg:    "rgba(245,158,11,0.1)",
                  bgSel: "rgba(245,158,11,0.18)",
                },
                {
                  value: "receber" as Tab,
                  label: "A Receber",
                  icon:  <TrendingUp size={32} />,
                  desc:  "Registrar uma entrada ou crédito",
                  cor:   "#10b981",
                  bg:    "rgba(16,185,129,0.08)",
                  bgSel: "rgba(16,185,129,0.18)",
                },
              ].map(op => (
                <motion.button key={op.value}
                  onClick={() => { setTipo(op.value); go(1) }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 p-5 rounded-2xl text-left transition-all border-2"
                  style={{
                    background: op.bg,
                    borderColor: op.cor,
                    color: op.cor,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = op.bgSel }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = op.bg }}>
                  <div className="mb-3">{op.icon}</div>
                  <p className="font-bold text-base uppercase">{op.label}</p>
                  <p className="text-sm mt-1 uppercase" style={{ color: `${op.cor}99` }}>{op.desc}</p>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>

      <SuccessOverlay show={salvoOk} titulo={isPagar ? "Conta a pagar criada!" : "Conta a receber criada!"} subtitulo={form.descricao || ""} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>Brechó Bellasu</span>
          <span style={{ color: "var(--border-hover)" }}>|</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Nova Conta a {isPagar ? "Pagar" : "Receber"}
          </span>
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
              className="absolute inset-0 flex flex-col items-center justify-center px-6">
              <div className="w-full max-w-xl">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base font-bold" style={{ color: cor }}>{step}</span>
                  <ArrowRight size={14} style={{ color: cor }} />
                </div>

                {step === 1 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                    {isPagar ? "Qual é o fornecedor?" : "Qual é a descrição?"}
                  </h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                    {isPagar ? "Nome do fornecedor ou identificação desta conta." : "Uma identificação clara desta conta."}
                  </p>
                  <input ref={inputRef} value={form.descricao} onChange={e => set("descricao", e.target.value.toUpperCase())}
                    placeholder={isPagar ? "Ex: CPFL, ALUGUEL, FORNECEDOR..." : "Ex: VENDA À PRAZO, SINAL..."}
                    className={iBase} style={{ ...iSt, textTransform: "uppercase" }} autoComplete="off" />
                </>}

                {step === 2 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Qual o valor?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                    {isPagar ? "Quanto você precisa pagar." : "Quanto você vai receber."}
                  </p>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-semibold" style={{ color: "var(--text-muted)" }}>R$</span>
                    <input ref={inputRef}
                      type="text" inputMode="decimal"
                      value={valorFormatado !== "" ? valorFormatado : form.valor}
                      onFocus={() => setValorFormatado("")}
                      onChange={e => {
                        setValorFormatado("")
                        set("valor", e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))
                      }}
                      onBlur={() => {
                        const n = parseFloat(form.valor.replace(",", "."))
                        if (!isNaN(n) && n > 0) setValorFormatado(fmtBRL(n))
                        else setValorFormatado("")
                      }}
                      placeholder="0,00"
                      className={cn(iBase, "pl-14")} style={iSt} />
                  </div>
                </>}

                {step === 3 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                    {isPagar ? "Quando vence?" : "Data de recebimento?"}
                  </h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Data limite para este lançamento.</p>
                  <DatePicker value={form.vencimento} onChange={v => set("vencimento", v)}
                    textFirst textInputRef={inputRef}
                    inputClassName={iBase} />
                </>}

                {step === 4 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Categoria?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Ajuda a organizar os relatórios.</p>
                  <input ref={inputRef} value={form.categoria} onChange={e => set("categoria", e.target.value)}
                    placeholder={isPagar ? "Ex: Aluguel, Energia, Estoque..." : "Ex: Vendas, Serviços..."}
                    className={iBase} style={iSt} autoComplete="off" />
                </>}

                <AnimatePresence>
                  {erro && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-2 text-sm" style={{ color: "#f87171" }}>{erro}</motion.p>}
                </AnimatePresence>

                <div className="flex items-center gap-4 mt-8">
                  <button onClick={advance}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg transition-opacity"
                    style={{ background: cor }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                    {returnToRevisao ? <>← Voltar ao resumo</> : step === 1 ? <>OK, continuar <ArrowRight size={15} /></> : <>Continuar <ArrowRight size={15} /></>}
                  </button>
                  {step > 1 && !returnToRevisao && (
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
            <motion.div key="revisao" custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="absolute inset-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
              {/* Sidebar */}
              <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col items-center justify-between py-4 md:py-10 px-5 md:px-6 gap-4 md:gap-0"
                style={{ background: cor }}>
                <div className="flex flex-row md:flex-col items-center gap-4 md:text-center">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                      <Wallet size={22} color="#fff" className="md:hidden" />
                      <Wallet size={32} color="#fff" className="hidden md:block" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center bg-white/90">
                      <Check size={10} style={{ color: cor }} className="md:hidden" />
                      <Check size={14} style={{ color: cor }} className="hidden md:block" />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-sm md:text-lg leading-tight text-white uppercase">{form.descricao || "—"}</p>
                    <p className="text-lg md:text-2xl font-bold text-white mt-0.5 md:mt-1">{fmtBRL(Number(form.valor))}</p>
                    <p className="text-xs mt-0.5 md:mt-1 hidden md:block" style={{ color: "rgba(255,255,255,0.65)" }}>Revise antes de salvar</p>
                  </div>
                </div>
                <div className="flex flex-row md:flex-col gap-2 md:w-full shrink-0">
                  <button onClick={handleSalvar} disabled={saving}
                    className="py-2.5 md:py-3 px-4 md:px-0 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 md:w-full"
                    style={{ background: "#fff", color: cor }}>
                    {saving ? <><Loader2 size={15} className="animate-spin" />Salvando...</> : `Salvar`}
                  </button>
                  <button onClick={onClose} className="py-2.5 px-4 md:px-0 rounded-2xl text-sm font-medium md:w-full"
                    style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}>
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Painel */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-10" style={{ background: "var(--bg-base)" }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-6" style={{ color: "var(--text-muted)" }}>
                  ◎ Conta a {isPagar ? "Pagar" : "Receber"}
                </h2>
                {erro && <p className="mb-4 text-sm px-4 py-2 rounded-xl" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>{erro}</p>}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Descrição",  value: form.descricao  || "—", s: 1, full: true },
                    { label: "Valor",      value: fmtBRL(Number(form.valor)), s: 2 },
                    { label: "Vencimento", value: form.vencimento ? fmtData(form.vencimento) : "—", s: 3 },
                    { label: "Categoria",  value: form.categoria  || "—", s: 4 },
                  ].map(({ label, value, s, full }) => (
                    <div key={label} className={cn("rounded-2xl p-4", full ? "col-span-2" : "")}
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${cor}` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>{value}</p>
                      <button onClick={() => { setReturnToRevisao(true); go(s) }}
                        className="flex items-center gap-1 text-xs mt-1.5 font-semibold uppercase tracking-wide transition-opacity"
                        style={{ color: cor }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.65" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                        ✎ EDITAR
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {step < TOTAL && (
        <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          {step > 1 ? (
            <button onClick={() => go(step - 1)}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)" }}>
              <ChevronLeft size={15} /> Voltar
            </button>
          ) : <span />}
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Pressione <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Enter</kbd> para avançar
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Página ───────────────────────────────────────────────
export default function FinanceiroPage() {
  const qc = useQueryClient()
  const [tab, setTab]     = useState<Tab>("pagar")
  const [wizard, setWizard] = useState(false)
  const [status, setStatus] = useState("")

  const { data, isLoading } = useQuery<{ data: Conta[]; total: number; soma: number }>({
    queryKey: ["financeiro", tab, status],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: "100", ...(status && { status }) }).toString()
      return apiGet(`/financeiro/${tab}?${qs}`)
    },
    staleTime: 30_000,
  })

  const { data: resumo } = useQuery<Resumo>({
    queryKey: ["financeiro-resumo"],
    queryFn: () => apiGet("/financeiro/resumo"),
    staleTime: 60_000,
  })

  const marcarPago = useMutation({
    mutationFn: (id: number) => apiPatch(`/financeiro/${tab}/${id}/${tab}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro"] }),
  })

  const excluir = useMutation({
    mutationFn: (id: number) => apiDelete(`/financeiro/pagar/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro"] }),
  })

  // Alertas de contas a vencer
  const { data: alertas } = useQuery<{ pagar: { id: number; descricao: string; valor: number; vencimento: string; vencido: boolean }[]; receber: { id: number; descricao: string; valor: number; vencimento: string; vencido: boolean }[] }>({
    queryKey: ["financeiro-alertas"],
    queryFn: () => apiGet("/financeiro/alertas"),
    staleTime: 120_000,
  })
  const [enviandoAlerta, setEnviandoAlerta] = useState(false)
  const [alertaMsg, setAlertaMsg] = useState("")
  const alertasPagar = alertas?.pagar ?? []

  async function dispararAlerta() {
    setEnviandoAlerta(true); setAlertaMsg("")
    try {
      const res = await apiPost("/financeiro/alertas", {}) as { enviados?: number; mensagem?: string; erro?: string }
      setAlertaMsg(res.erro ? `❌ ${res.erro}` : `✅ Alerta enviado para ${res.enviados} número(s)`)
    } catch (e: unknown) {
      setAlertaMsg(`❌ ${(e as Error).message || "Erro ao enviar alerta."}`)
    } finally { setEnviandoAlerta(false) }
  }

  const contas = data?.data ?? []
  const statusOps = tab === "pagar" ? ["","pendente","pago","vencido"] : ["","pendente","recebido"]

  const [tableFocused, setTableFocused] = useState(false)
  const { sel, onKeyDown: tableKeyDown, reset: resetSel } = useTableKeyNav(contas, () => {/* foco visual apenas */})

  return (
    <div className="space-y-5 pt-3 sm:pt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>Financeiro</h2>
        <button onClick={() => setWizard(true)}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white shadow-lg transition-opacity"
          style={{ background: "var(--accent)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
          <Plus size={16}/> Nova Conta
        </button>
      </div>

      {/* Resumo */}
      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["Entradas do mês", fmtBRL(resumo.entradas_mes), "#10b981"],
            ["Saídas do mês",   fmtBRL(resumo.saidas_mes),   "#f87171"],
            ["A pagar",         fmtBRL(resumo.total_pagar),   "#f59e0b"],
            ["A receber",       fmtBRL(resumo.total_receber), "#60a5fa"],
          ].map(([l, v, c]) => (
            <div key={l} className="rounded-2xl p-5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{l}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: c as string }}>{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alertas de contas a vencer */}
      {alertasPagar.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
              <span className="text-sm font-bold" style={{ color: "#f59e0b" }}>
                {alertasPagar.length} conta(s) vencendo nos próximos 3 dias
              </span>
            </div>
            <button onClick={dispararAlerta} disabled={enviandoAlerta}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: "rgba(37,211,102,0.15)", color: "#25d366" }}>
              {enviandoAlerta ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar alerta WhatsApp
            </button>
          </div>
          {alertaMsg && <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>{alertaMsg}</p>}
          <div className="space-y-1.5">
            {alertasPagar.map(a => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--bg-surface)" }}>
                <span style={{ color: "var(--text-primary)" }}>{a.descricao}</span>
                <div className="flex items-center gap-3">
                  <span style={{ color: "var(--text-muted)" }}>{fmtData(a.vencimento)}</span>
                  <span className="font-semibold" style={{ color: a.vencido ? "#f87171" : "#f59e0b" }}>
                    {fmtBRL(a.valor)}
                  </span>
                  {a.vencido && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">VENCIDA</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex gap-1.5">
          {(["pagar","receber"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold uppercase transition-all"
              style={{ background: tab === t ? "var(--accent)" : "transparent", color: tab === t ? "#fff" : "var(--text-secondary)" }}>
              A {t}
            </button>
          ))}
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="ml-auto py-2 px-3 rounded-xl text-sm outline-none uppercase"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          {statusOps.map(s => <option key={s} value={s}>{s ? s.toUpperCase() : "STATUS"}</option>)}
        </select>
      </div>

      {data && (
        <div className="text-right">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Total filtrado: </span>
          <span className="font-bold" style={{ color: "var(--text-primary)" }}>{fmtBRL(data.soma)}</span>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div
          tabIndex={0}
          onKeyDown={tableKeyDown}
          onFocus={() => setTableFocused(true)}
          onBlur={() => { setTableFocused(false); resetSel() }}
          className="overflow-x-auto outline-none"
        >
          <table className="w-full min-w-[560px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Descrição","Valor","Vencimento","Status","Categoria","Ações"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "var(--accent)" }} />
                </td></tr>
              ) : contas.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>Nenhuma conta encontrada.</td></tr>
              ) : contas.map((c, idx) => {
                const isPago = c.status === "pago" || c.status === "recebido"
                const isVencido = c.status === "vencido"
                return (
                  <tr key={c.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border)", background: sel === idx ? "var(--accent-bg)" : "transparent", borderLeft: sel === idx ? "3px solid var(--accent)" : "3px solid transparent", outline: "none" }}
                    onMouseEnter={e => { if (sel !== idx) (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)" }}
                    onMouseLeave={e => { if (sel !== idx) (e.currentTarget as HTMLTableRowElement).style.background = "transparent" }}>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.descricao}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmtBRL(c.valor)}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{fmtData(c.vencimento)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full",
                        isPago ? "bg-emerald-500/10 text-emerald-400"
                        : isVencido ? "bg-red-500/10 text-red-400"
                        : "bg-amber-500/10 text-amber-400")}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>{c.categoria ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!isPago && (
                          <button onClick={() => marcarPago.mutate(c.id)}
                            className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#4ade80" }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                            <Check size={14}/>
                          </button>
                        )}
                        {tab === "pagar" && (
                          <button onClick={() => { if (confirm("Excluir esta conta?")) excluir.mutate(c.id) }}
                            className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171" }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                            <Trash2 size={14}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {tableFocused && (
          <div className="px-4 py-2 flex items-center gap-3 border-t" style={{ borderColor: "var(--border)" }}>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 10 }}>↑↓</kbd>
              {" "}navegar{" · "}
              <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 10 }}>Esc</kbd>
              {" "}deselecionar
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {wizard && <WizardConta onClose={() => setWizard(false)} onSalvo={() => setWizard(false)} />}
      </AnimatePresence>
    </div>
  )
}
