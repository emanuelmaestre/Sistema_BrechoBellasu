"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import {
  Plus, Loader2, Check, Trash2,
  X, TrendingDown, TrendingUp,
  AlertTriangle, Send,
} from "lucide-react"
import { apiGet, apiPost, apiPatch, apiDelete } from "@/services/api"
import { useConfirm } from "@/components/ui/ConfirmProvider"
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

// ─── Wizard Financeiro (tela única após seleção de tipo) ──
function WizardConta({ onClose, onSalvo }: { onClose: () => void; onSalvo: () => void }) {
  const qc = useQueryClient()
  const [tipo, setTipo]         = useState<Tab | null>(null)
  const [form, setForm]         = useState<ContaForm>(EMPTY)
  const [erro, setErro]         = useState("")
  const [saving, setSaving]     = useState(false)
  const [salvoOk, setSalvoOk]   = useState(false)
  const [valorFormatado, setValorFormatado] = useState("")
  const descRef = useRef<HTMLInputElement>(null)

  const isPagar = tipo === "pagar"
  const cor     = tipo === "pagar" ? "#f59e0b" : tipo === "receber" ? "#10b981" : "var(--accent)"

  useEffect(() => {
    if (tipo) setTimeout(() => descRef.current?.focus(), 120)
  }, [tipo])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  function set(k: keyof ContaForm, v: string) { setForm(f => ({ ...f, [k]: v })); setErro("") }

  async function handleSalvar() {
    if (!form.descricao.trim()) { setErro("Descrição é obrigatória"); return }
    if (!form.valor || Number(form.valor) <= 0) { setErro("Informe um valor válido"); return }
    if (!form.vencimento) { setErro("Vencimento é obrigatório"); return }
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
    } finally { setSaving(false) }
  }

  const iBase = "w-full px-3 py-2 text-sm rounded-xl outline-none transition-all border focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }
  const lSt  = "block text-[10px] font-bold uppercase tracking-wider mb-1"
  const lCol: React.CSSProperties = { color: "var(--text-muted)" }

  // Tela 1: seleção de tipo
  if (!tipo) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>
        <div className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>Brechó Bellasu</span>
            <span style={{ color: "var(--border-hover)" }}>|</span>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Nova Conta</span>
          </div>
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
            <X size={15} /> Cancelar
          </button>
        </div>
        <div className="flex-1 flex flex-col px-6 py-6">
          <div className="w-full">
            <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>O que você quer lançar?</h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>Selecione o tipo de lançamento financeiro.</p>
            <div className="flex gap-4">
              {[
                { value: "pagar" as Tab, label: "A Pagar", icon: <TrendingDown size={28} />, desc: "Saída ou despesa", cor: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
                { value: "receber" as Tab, label: "A Receber", icon: <TrendingUp size={28} />, desc: "Entrada ou crédito", cor: "#10b981", bg: "rgba(16,185,129,0.08)" },
              ].map(op => (
                <motion.button key={op.value} onClick={() => setTipo(op.value)}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="flex-1 p-5 rounded-2xl text-left border-2 transition-all"
                  style={{ background: op.bg, borderColor: op.cor, color: op.cor }}>
                  <div className="mb-3">{op.icon}</div>
                  <p className="font-bold text-base uppercase">{op.label}</p>
                  <p className="text-sm mt-1" style={{ color: `${op.cor}99` }}>{op.desc}</p>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // Tela 2: formulário único
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>
      <SuccessOverlay show={salvoOk} titulo={isPagar ? "Conta a pagar criada!" : "Conta a receber criada!"} subtitulo={form.descricao || ""} />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setTipo(null)} className="text-sm font-medium transition-colors"
            style={{ color: cor }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.7" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
            ← Trocar tipo
          </button>
          <span style={{ color: "var(--border-hover)" }}>|</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Nova Conta a {isPagar ? "Pagar" : "Receber"}
          </span>
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
          <X size={15} /> Cancelar
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="w-full space-y-4">

          {/* Descrição */}
          <div>
            <label className={lSt} style={lCol}>{isPagar ? "Fornecedor / Descrição *" : "Descrição *"}</label>
            <input ref={descRef} value={form.descricao}
              onChange={e => set("descricao", e.target.value.toUpperCase())}
              placeholder={isPagar ? "EX: CPFL, ALUGUEL, FORNECEDOR..." : "EX: VENDA À PRAZO, SINAL..."}
              className={iBase} style={{ ...iSt, textTransform: "uppercase" }} autoComplete="off" />
          </div>

          {/* Valor | Vencimento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lSt} style={lCol}>Valor *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold"
                  style={{ color: "var(--text-muted)" }}>R$</span>
                <input type="text" inputMode="decimal"
                  value={valorFormatado !== "" ? valorFormatado : form.valor}
                  onFocus={() => setValorFormatado("")}
                  onChange={e => { setValorFormatado(""); set("valor", e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".")) }}
                  onBlur={() => {
                    const n = parseFloat(form.valor.replace(",", "."))
                    if (!isNaN(n) && n > 0) setValorFormatado(fmtBRL(n))
                    else setValorFormatado("")
                  }}
                  placeholder="0,00"
                  className={cn(iBase, "pl-9")} style={iSt} />
              </div>
            </div>
            <div>
              <label className={lSt} style={lCol}>{isPagar ? "Vencimento *" : "Data de recebimento *"}</label>
              <DatePicker value={form.vencimento} onChange={v => set("vencimento", v)}
                textFirst inputClassName={iBase} />
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className={lSt} style={lCol}>Categoria (opcional)</label>
            <input value={form.categoria}
              onChange={e => set("categoria", e.target.value)}
              placeholder={isPagar ? "Ex: Aluguel, Energia, Estoque..." : "Ex: Vendas, Serviços..."}
              className={iBase} style={iSt} autoComplete="off" />
          </div>

          {/* Error */}
          {erro && <p className="text-sm" style={{ color: "#f87171" }}>{erro}</p>}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-3 shrink-0"
        style={{ borderTop: "1px solid var(--border)" }}>
        <button onClick={onClose}
          className="text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
          Cancelar
        </button>
        <button onClick={handleSalvar} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity disabled:opacity-50"
          style={{ background: cor }}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><Check size={14} /> Salvar conta</>}
        </button>
      </div>
    </motion.div>
  )
}

export default function FinanceiroPage() {
  const qc = useQueryClient()
  const confirmar = useConfirm()
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
                          <button onClick={async () => {
                            const ok = await confirmar({
                              titulo: "Excluir esta conta?",
                              descricao: `${c.descricao} — ${fmtBRL(c.valor)}. Esta ação não pode ser desfeita.`,
                              confirmar: "Excluir",
                              perigo: true,
                            })
                            if (ok) excluir.mutate(c.id)
                          }}
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
