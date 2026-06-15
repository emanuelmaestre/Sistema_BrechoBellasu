"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "motion/react"
import {
  Plus, Search, X, ChevronLeft, ArrowRight, Check,
  Loader2, RefreshCw, Pencil, ShoppingCart, Trash2, MessageCircle,
  CheckCircle2, XCircle, Clock, Send, FileText, Printer,
} from "lucide-react"
import { apiGet, apiPost, apiDelete } from "@/services/api"
import { SuccessOverlay } from "@/components/SuccessOverlay"
import { DatePickerCompact } from "@/components/DatePicker"
import { fmtBRL, fmtData, cn } from "@/lib/utils"
import type { Cliente, Produto } from "@/types"
import { useTableKeyNav, useDropdownKeyNav } from "@/hooks/useKeyNav"
import { gerarReciboPDF, imprimirRecibo } from "@/lib/recibo-pdf"

// ─── Tipos ────────────────────────────────────────────────
interface VendaListItem {
  id: number; numero: number; data_venda: string; hora_venda: string
  cliente_nome: string | null; vendedor_nome: string | null
  qtd_itens: number; total: number; forma_pagamento: string
  notificacao_status?: "pendente" | "enviado" | "erro" | null
}
interface VendaDetalhe extends VendaListItem {
  desconto: number; observacoes: string | null
  cliente_celular?: string | null
  itens: { nome_produto: string; quantidade: number; preco_unitario: number; subtotal: number; marca?: string | null }[]
}
interface WizItem {
  produto_id: number | null; nome_produto: string
  quantidade: number; preco_unitario: number
  marca?: string | null
}

const FORMAS = ["Dinheiro", "Pix", "Cartão de Débito", "Cartão de Crédito", "Crédito"]
const PERIODO_OPTIONS = [
  { key: "hoje",   label: "Hoje" },
  { key: "semana", label: "7 dias" },
  { key: "mes",    label: "30 dias" },
  { key: "custom", label: "Período" },
]
const COR = "#10b981"

function getPeriodoParams(periodo: string, de: string, ate: string) {
  const fmt = (d: Date) => d.toISOString().split("T")[0]
  const hoje = new Date()
  if (periodo === "hoje")   return { de: fmt(hoje), ate: fmt(hoje) }
  if (periodo === "semana") { const d = new Date(hoje); d.setDate(d.getDate() - 6); return { de: fmt(d), ate: fmt(hoje) } }
  if (periodo === "mes")    { const d = new Date(hoje); d.setDate(d.getDate() - 29); return { de: fmt(d), ate: fmt(hoje) } }
  if (periodo === "custom") return { de: de || undefined, ate: ate || undefined }
  return {}
}

// ─── Animação ─────────────────────────────────────────────
const variants = {
  enter:  (d: number) => ({ x: d > 0 ?  60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: d > 0 ? -60 :  60, opacity: 0 }),
}

// ─── Badge notificação ────────────────────────────────────
function BadgeNotif({ status }: { status?: "pendente" | "enviado" | "erro" | null }) {
  if (!status) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400">—</span>
  const map = {
    pendente: { bg: "bg-amber-500/10",   text: "text-amber-400",   icon: <Clock size={9} />,         label: "Pendente" },
    enviado:  { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: <CheckCircle2 size={9} />,  label: "Enviado"  },
    erro:     { bg: "bg-red-500/10",     text: "text-red-400",     icon: <XCircle size={9} />,       label: "Erro"     },
  }
  const { bg, text, icon, label } = map[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${bg} ${text}`}>
      {icon} {label}
    </span>
  )
}

// ─── Modal Detalhe ────────────────────────────────────────
function ModalDetalhe({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient()

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  const { data: venda, isLoading, refetch } = useQuery<VendaDetalhe>({
    queryKey: ["venda", id],
    queryFn: () => apiGet(`/vendas/${id}`),
  })
  const cancelar = useMutation({
    mutationFn: () => apiDelete(`/vendas/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendas"] }); onClose() },
  })
  const [enviandoRecibo, setEnviandoRecibo] = useState(false)
  const [reciboMsg, setReciboMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [confirmCancelar, setConfirmCancelar] = useState(false)

  async function gerarEEnviarPDF(reenviar = false) {
    if (!venda) return
    setEnviandoRecibo(true); setReciboMsg(null)
    try {
      const pdfBlob = await gerarReciboPDF({
        numero: venda.numero,
        tipo: "Venda",
        data: `${fmtData(venda.data_venda)} ${venda.hora_venda?.slice(0,5) ?? ""}`,
        cliente_nome: venda.cliente_nome ?? "Avulso",
        cliente_celular: venda.cliente_celular ?? "",
        itens: venda.itens.map(it => ({
          nome: it.nome_produto,
          qtd: it.quantidade,
          preco_unit: it.preco_unitario,
          subtotal: it.subtotal ?? it.quantidade * it.preco_unitario,
          marca: it.marca ?? null,
        })),
        forma_pagamento: venda.forma_pagamento ?? "PIX",
        desconto: venda.desconto ?? 0,
        total: venda.total,
      })
      const arrayBuffer = await pdfBlob.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)
      let binary = ""
      for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i])
      const base64 = btoa(binary)

      await apiPost(`/vendas/${id}/recibo`, { pdfBase64: base64, reenviar })
      setReciboMsg({ ok: true, texto: "✅ Recibo enviado por WhatsApp!" })
      qc.invalidateQueries({ queryKey: ["vendas"] })
      refetch()
    } catch (e: unknown) {
      setReciboMsg({ ok: false, texto: (e as Error).message || "Erro ao enviar recibo." })
      qc.invalidateQueries({ queryKey: ["vendas"] })
      refetch()
    } finally { setEnviandoRecibo(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {venda ? `Venda #${venda.numero}` : "Detalhes"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : venda ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  ["Data",      `${fmtData(venda.data_venda)} ${venda.hora_venda?.slice(0,5) ?? ""}`],
                  ["Cliente",   (venda.cliente_nome ?? "Consumidor Final").toUpperCase()],
                  ["Pagamento", venda.forma_pagamento ?? "—"],
                  ["Desconto",  venda.desconto > 0 ? fmtBRL(venda.desconto) : "R$ 0,00"],
                  ["Itens",     String(venda.qtd_itens ?? 0)],
                  ["Total",     fmtBRL(venda.total)],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>{l}</p>
                    <p className={cn("text-sm mt-0.5", l === "Total" ? "font-bold text-base" : "")}
                      style={{ color: l === "Total" ? COR : "var(--text-primary)" }}>{v}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Itens</p>
              <div className="space-y-1.5 mb-4">
                {venda.itens.map((it, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                    <div>
                      <p className="text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>{it.nome_produto}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{it.quantidade}x · {fmtBRL(it.preco_unitario)}</p>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {fmtBRL(it.subtotal ?? it.quantidade * it.preco_unitario)}
                    </p>
                  </div>
                ))}
              </div>
              {venda.observacoes && (
                <p className="mb-4 text-sm px-4 py-3 rounded-xl" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                  📝 {venda.observacoes}
                </p>
              )}
              {/* Pré-visualizar Recibo */}
              <button
                onClick={async () => {
                  const blob = await gerarReciboPDF({
                    numero: venda.numero,
                    tipo: "Venda",
                    data: `${fmtData(venda.data_venda)} ${venda.hora_venda?.slice(0,5) ?? ""}`,
                    cliente_nome: venda.cliente_nome ?? "Avulso",
                    cliente_celular: venda.cliente_celular ?? "",
                    itens: venda.itens.map(it => ({
                      nome: it.nome_produto,
                      qtd: it.quantidade,
                      preco_unit: it.preco_unitario,
                      subtotal: it.subtotal ?? it.quantidade * it.preco_unitario,
                      marca: it.marca ?? null,
                    })),
                    forma_pagamento: venda.forma_pagamento ?? "PIX",
                    desconto: venda.desconto ?? 0,
                    total: venda.total,
                  })
                  const url = URL.createObjectURL(blob)
                  window.open(url, "_blank")
                }}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-2"
                style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.18)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.1)" }}>
                <FileText size={16} /> Pré-visualizar Recibo (PDF)
              </button>
              {/* Imprimir / Salvar com texto selecionável */}
              <button
                onClick={() => imprimirRecibo({
                  numero: venda.numero,
                  tipo: "Venda",
                  data: `${fmtData(venda.data_venda)} ${venda.hora_venda?.slice(0,5) ?? ""}`,
                  cliente_nome: venda.cliente_nome ?? "Avulso",
                  cliente_celular: venda.cliente_celular ?? "",
                  itens: venda.itens.map(it => ({
                    nome: it.nome_produto,
                    qtd: it.quantidade,
                    preco_unit: it.preco_unitario,
                    subtotal: it.subtotal ?? it.quantidade * it.preco_unitario,
                    marca: it.marca ?? null,
                  })),
                  forma_pagamento: venda.forma_pagamento ?? "PIX",
                  desconto: venda.desconto ?? 0,
                  total: venda.total,
                })}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-2"
                style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(251,191,36,0.15)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(251,191,36,0.08)" }}>
                <Printer size={16} /> Imprimir / Salvar (texto selecionável)
              </button>
              {/* Status de notificação */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Recibo WhatsApp:</span>
                <BadgeNotif status={(venda as VendaDetalhe & { notificacao_status?: "pendente"|"enviado"|"erro"|null }).notificacao_status} />
              </div>

              {/* Botão envio manual — bloqueado se já ENVIADO */}
              {(venda as VendaDetalhe & { notificacao_status?: string }).notificacao_status !== "enviado" ? (
                <button
                  onClick={() => gerarEEnviarPDF(true)}
                  disabled={enviandoRecibo}
                  className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-2"
                  style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25d366" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(37,211,102,0.18)" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(37,211,102,0.1)" }}>
                  {enviandoRecibo ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {enviandoRecibo ? "Enviando..." : (
                    (venda as VendaDetalhe & { notificacao_status?: string }).notificacao_status === "erro"
                      ? "Reenviar Recibo via WhatsApp"
                      : "Enviar Recibo via WhatsApp"
                  )}
                </button>
              ) : (
                <div className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mb-2"
                  style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
                  <CheckCircle2 size={15} /> Recibo já enviado
                </div>
              )}
              {reciboMsg && (
                <p className={cn("text-xs text-center mb-2 px-2 py-1.5 rounded-lg", reciboMsg.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
                  {reciboMsg.texto}
                </p>
              )}
              {!confirmCancelar ? (
                <button
                  onClick={() => setConfirmCancelar(true)}
                  disabled={cancelar.isPending}
                  className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.08)" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                  Cancelar Venda
                </button>
              ) : (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-3 space-y-2"
                  style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
                  <p className="text-sm text-center font-medium" style={{ color: "#f87171" }}>
                    Confirmar cancelamento da venda?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmCancelar(false)}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                      Não, voltar
                    </button>
                    <button onClick={() => { cancelar.mutate(); setConfirmCancelar(false) }}
                      disabled={cancelar.isPending}
                      className="flex-1 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: "#ef4444" }}>
                      {cancelar.isPending ? "Cancelando..." : "Sim, cancelar"}
                    </button>
                  </div>
                </motion.div>
              )}
            </>
          ) : <p className="text-center py-12" style={{ color: "var(--text-muted)" }}>Venda não encontrada.</p>}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Wizard Nova Venda ────────────────────────────────────
function WizardNovaVenda({ onClose, onSalvo }: { onClose: () => void; onSalvo: () => void }) {
  const [step, setStep]           = useState(1)
  const [dir, setDir]             = useState(1)
  const [erro, setErro]           = useState("")
  const [saving, setSaving]       = useState(false)
  const [salvoOk, setSalvoOk]     = useState(false)

  // Step 1 — cliente
  const [clienteId, setClienteId] = useState<number | null>(null)
  const [clienteNome, setClienteNome]     = useState("")
  const [clienteCelular, setClienteCelular] = useState<string | null>(null)
  const [cliBusca, setCliBusca]   = useState("")
  const [cliRes, setCliRes]       = useState<Cliente[]>([])

  // Step 2 — produtos
  const [itens, setItens]         = useState<WizItem[]>([])
  const [prodBusca, setProdBusca] = useState("")
  const [prodRes, setProdRes]     = useState<Produto[]>([])

  // Step 3 — pagamento (multi-select)
  const [formas, setFormas]       = useState<string[]>(["Dinheiro"])
  const [saldoCredito, setSaldoCredito] = useState(0)

  // Step 4 — divisão do pagamento (só quando formas.length > 1)
  const [divisao, setDivisao]     = useState<Record<string, number>>({})

  // Step 5 — desconto
  const [desconto, setDesconto]   = useState("")

  // Step 6 — observações
  const [obs, setObs]             = useState("")

  const inputRef   = useRef<HTMLInputElement>(null)
  const obsRef     = useRef<HTMLTextAreaElement>(null)
  const TOTAL = 7

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 280)
    return () => clearTimeout(t)
  }, [step])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  const buscarClientes = useCallback(async (val: string) => {
    setCliBusca(val); setClienteId(null); setClienteNome("")
    if (val.length < 2) { setCliRes([]); return }
    try {
      const res = await apiGet<{ data: Cliente[] }>(`/clientes?busca=${encodeURIComponent(val)}&limit=8`)
      setCliRes(res.data ?? [])
    } catch { setCliRes([]) }
  }, [])

  const buscarProdutos = useCallback(async (val: string) => {
    setProdBusca(val)
    if (val.length < 2) { setProdRes([]); return }
    try {
      const res = await apiGet<{ data: Produto[] }>(`/produtos?busca=${encodeURIComponent(val)}&limit=8`)
      setProdRes(res.data ?? [])
    } catch { setProdRes([]) }
  }, [])

  function selecionarCliente(c: Cliente) {
    setClienteId(c.id); setClienteNome(c.nome)
    setClienteCelular((c as Cliente & { celular?: string | null }).celular ?? null)
    setSaldoCredito(Number((c as Cliente & { saldo_credito?: number }).saldo_credito ?? 0))
    setCliBusca(c.nome); setCliRes([])
  }

  function adicionarProduto(p: Produto) {
    setItens(prev => [...prev, { produto_id: p.id, nome_produto: p.nome, quantidade: 1, preco_unitario: p.preco_venda ?? 0, marca: (p as { marca?: string }).marca ?? null }])
    setProdBusca(""); setProdRes([])
  }

  const { hi: cliHi, onKeyDown: cliDropKeyDown, reset: resetCliHi } = useDropdownKeyNav(cliRes, selecionarCliente)
  const { hi: prodHi, onKeyDown: prodDropKeyDown, reset: resetProdHi } = useDropdownKeyNav(prodRes, adicionarProduto)

  // Step 3 — keyboard nav para grade 2 colunas de formas de pagamento
  const COLS = 2
  const [formaIdx, setFormaIdx] = useState(0)

  function toggleForma(f: string) {
    setFormas(prev => prev.includes(f) ? (prev.length > 1 ? prev.filter(x => x !== f) : prev) : [...prev, f])
  }

  useEffect(() => {
    if (step !== 3) return
    function handlePayKey(e: KeyboardEvent) {
      const len  = FORMAS.length
      const cols = COLS
      if (e.key === "ArrowRight") {
        e.preventDefault()
        setFormaIdx(i => (i + 1) % len)
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        setFormaIdx(i => (i - 1 + len) % len)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setFormaIdx(i => Math.min(i + cols, len - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setFormaIdx(i => Math.max(i - cols, 0))
      } else if (e.key === " ") {
        e.preventDefault()
        toggleForma(FORMAS[formaIdx])
      } else if (e.key === "Enter") {
        e.preventDefault()
        advance()
      }
    }
    document.addEventListener("keydown", handlePayKey)
    return () => document.removeEventListener("keydown", handlePayKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, formaIdx])

  function adicionarManual() {
    if (!prodBusca.trim()) return
    setItens(prev => [...prev, { produto_id: null, nome_produto: prodBusca.trim(), quantidade: 1, preco_unitario: 0 }])
    setProdBusca(""); setProdRes([])
  }

  function removerItem(i: number) { setItens(prev => prev.filter((_, idx) => idx !== i)) }

  function go(next: number) { setDir(next > step ? 1 : -1); setStep(next); setErro("") }

  function advance() {
    if (step === 2 && itens.length === 0) { setErro("Adicione pelo menos um produto"); return }
    if (step === 3) {
      if (formas.length === 1 && formas[0] === "Crédito" && totalFinal > saldoCredito) {
        setErro(`Crédito insuficiente. Disponível: ${fmtBRL(saldoCredito)}`); return
      }
      go(formas.length > 1 ? 4 : 5); return
    }
    if (step === 4) {
      const soma = formas.reduce((s, f) => s + (divisao[f] ?? 0), 0)
      const diff = soma - totalFinal
      if (Math.abs(diff) > 0.01) {
        setErro(diff < 0 ? `Falta distribuir ${fmtBRL(totalFinal - soma)}` : `Soma ultrapassa o total em ${fmtBRL(diff)}`); return
      }
      if (formas.includes("Crédito") && (divisao["Crédito"] ?? 0) > saldoCredito) {
        setErro(`Crédito insuficiente. Disponível: ${fmtBRL(saldoCredito)}`); return
      }
      go(5); return
    }
    if (step < TOTAL) go(step + 1)
  }

  const descontoVal = parseFloat(desconto.replace(",", ".")) || 0
  const totalBruto  = itens.reduce((s, it) => s + it.preco_unitario * it.quantidade, 0)
  const totalFinal  = Math.max(0, totalBruto - descontoVal)

  async function handleSalvar() {
    setSaving(true); setErro("")
    try {
      let creditoUsarVal = 0
      if (formas.includes("Crédito")) {
        creditoUsarVal = formas.length === 1 ? totalFinal : (divisao["Crédito"] ?? 0)
      }
      const res = await apiPost<{ id: number; total: number }>("/vendas", {
        cliente_id: clienteId,
        forma_pagamento: formas.join(" + "),
        desconto_geral: descontoVal,
        observacoes: obs || null,
        itens,
        credito_usar: creditoUsarVal > 0 ? creditoUsarVal : undefined,
      })

      // ── Envio automático do recibo (regra 2) ──────────────
      // Só tenta se tem cliente selecionado (para ter celular)
      if (res.id && clienteId) {
        try {
          const pdfBlob = await gerarReciboPDF({
            numero: res.id,
            tipo: "Venda",
            data: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            cliente_nome: clienteNome || "Cliente",
            cliente_celular: clienteCelular ?? "",
            itens: itens.map(it => ({
              nome: it.nome_produto,
              qtd: it.quantidade,
              preco_unit: it.preco_unitario,
              subtotal: it.preco_unitario * it.quantidade,
              marca: it.marca ?? null,
            })),
            forma_pagamento: formas.join(" + "),
            desconto: descontoVal,
            total: totalFinal,
          })
          const arrayBuffer = await pdfBlob.arrayBuffer()
          const uint8 = new Uint8Array(arrayBuffer)
          let binary = ""
          for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i])
          const base64 = btoa(binary)
          // Não bloqueia — dispara em background, não espera
          apiPost(`/vendas/${res.id}/recibo`, { pdfBase64: base64, reenviar: false }).catch(() => {})
        } catch { /* Falha no PDF não cancela a venda */ }
      }

      setSalvoOk(true)
      setTimeout(() => { setSalvoOk(false); onSalvo() }, 2200)
    } catch (e: unknown) {
      setErro((e as Error).message || "Erro ao registrar venda.")
    } finally { setSaving(false) }
  }

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step < TOTAL && step !== 2) {
      if (step === 6 && document.activeElement === obsRef.current && obs.trim() !== "") return
      e.preventDefault(); advance()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, itens, formas, obs, divisao, saldoCredito, totalFinal])

  const iBase = "w-full px-5 py-4 text-lg rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }

  const enderecoResumo = [
    clienteNome || "Consumidor Final",
    `${itens.length} produto(s)`,
    fmtBRL(totalFinal),
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>

      <SuccessOverlay show={salvoOk} titulo="Venda registrada!" subtitulo={clienteNome || "Sem cliente"} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: COR }}>Brechó Bellasu</span>
          <span style={{ color: "var(--border-hover)" }}>|</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Nova Venda</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>
            {step > 4 && formas.length === 1 ? step - 1 : step} / {formas.length > 1 ? TOTAL : TOTAL - 1}
          </span>
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
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
                  <span className="text-base font-bold" style={{ color: COR }}>{step}</span>
                  <ArrowRight size={14} style={{ color: COR }} />
                </div>

                {/* ── Step 1: Cliente ── */}
                {step === 1 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Buscar cliente?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Opcional — deixe em branco para Consumidor Final.</p>
                  <div className="relative">
                    <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                    <input
                      ref={inputRef}
                      value={cliBusca}
                      onChange={e => { buscarClientes(e.target.value); resetCliHi() }}
                      onKeyDown={cliDropKeyDown}
                      placeholder="Nome, CPF, WhatsApp ou @Instagram"
                      className={cn(iBase, "pl-12")} style={iSt} autoComplete="off" />
                  </div>
                  {cliRes.length > 0 && (
                    <div className="mt-2 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                      {cliRes.map((c, idx) => (
                        <button key={c.id} onClick={() => selecionarCliente(c)}
                          className="w-full px-4 py-3 text-left transition-colors"
                          style={{ borderBottom: "1px solid var(--border)", background: cliHi === idx ? "var(--accent-bg)" : "transparent", color: cliHi === idx ? "var(--accent)" : "inherit" }}
                          onMouseEnter={e => { if (cliHi !== idx) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                          onMouseLeave={e => { if (cliHi !== idx) (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                          <p className="text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>{c.nome}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.celular ?? "Sem WhatsApp"}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {clienteId && (
                    <div className="mt-3 px-4 py-3 rounded-2xl flex items-center gap-3"
                      style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.4)" }}>
                      <Check size={15} style={{ color: COR }} />
                      <p className="text-sm font-bold uppercase" style={{ color: COR }}>{clienteNome}</p>
                    </div>
                  )}
                </>}

                {/* ── Step 2: Produtos ── */}
                {step === 2 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Quais produtos?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Busque ou adicione manualmente.</p>
                  <div className="relative mb-3">
                    <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                    <input
                      ref={inputRef}
                      value={prodBusca}
                      onChange={e => { buscarProdutos(e.target.value); resetProdHi() }}
                      onKeyDown={prodDropKeyDown}
                      placeholder="Buscar produto por nome"
                      className={cn(iBase, "pl-12 !text-base !py-3")} style={iSt} autoComplete="off" />
                  </div>
                  {(prodRes.length > 0 || prodBusca.length >= 2) && (
                    <div className="mb-3 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                      {prodRes.map((p, idx) => (
                        <button key={p.id} onClick={() => adicionarProduto(p)}
                          className="w-full px-4 py-3 text-left transition-colors"
                          style={{ borderBottom: "1px solid var(--border)", background: prodHi === idx ? "var(--accent-bg)" : "transparent" }}
                          onMouseEnter={e => { if (prodHi !== idx) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                          onMouseLeave={e => { if (prodHi !== idx) (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                          <p className="text-sm font-medium uppercase" style={{ color: prodHi === idx ? "var(--accent)" : "var(--text-primary)" }}>{p.nome}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtBRL(p.preco_venda)} · Estoque: {p.estoque_atual ?? "—"}</p>
                        </button>
                      ))}
                      {prodBusca.length >= 2 && (
                        <button onClick={adicionarManual}
                          className="w-full px-4 py-3 text-left text-sm font-semibold transition-colors"
                          style={{ color: COR }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                          + Adicionar "{prodBusca}" manualmente
                        </button>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    {itens.map((it, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 rounded-2xl"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate uppercase" style={{ color: "var(--text-primary)" }}>{it.nome_produto}</p>
                          {it.preco_unitario > 0 && (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtBRL(it.preco_unitario)}</p>
                          )}
                        </div>
                        <button onClick={() => removerItem(i)} className="ml-3 p-1 rounded-lg transition-colors"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171" }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>}

                {/* ── Step 3: Pagamento ── */}
                {step === 3 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Forma de pagamento?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Selecione como o cliente vai pagar.</p>
                  <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Selecione uma ou mais formas de pagamento.</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {FORMAS.map((f, i) => {
                      const isSelected = formas.includes(f)
                      const isFocused  = formaIdx === i
                      return (
                        <motion.button key={f}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          whileHover={{ scale: 1.03, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { toggleForma(f); setFormaIdx(i) }}
                          className="relative py-4 px-4 rounded-2xl text-sm font-bold text-left uppercase overflow-hidden border-2"
                          style={{
                            background:  isSelected ? `${COR}18` : "var(--bg-surface)",
                            borderColor: isSelected ? COR : isFocused ? `${COR}80` : "var(--border)",
                            color:       isSelected ? COR : "var(--text-primary)",
                            boxShadow:   isFocused && !isSelected ? `0 0 0 3px ${COR}30` : undefined,
                            transition:  "background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s",
                          }}>
                          <AnimatePresence>
                            {isSelected && (
                              <motion.span
                                key="ripple"
                                initial={{ scale: 0, opacity: 0.4 }}
                                animate={{ scale: 4, opacity: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="absolute inset-0 m-auto w-12 h-12 rounded-full pointer-events-none"
                                style={{ background: COR }}
                              />
                            )}
                          </AnimatePresence>
                          <span className="relative z-10 flex items-center justify-between">
                            {f}
                            {isSelected && (
                              <motion.span
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                                <Check size={16} style={{ color: COR }} />
                              </motion.span>
                            )}
                          </span>
                        </motion.button>
                      )
                    })}
                  </div>
                  {/* Badge crédito disponível */}
                  {saldoCredito > 0 && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-4 px-4 py-3 rounded-2xl flex items-center justify-between"
                      style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)" }}>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#fbbf24" }}>Crédito disponível</p>
                        <p className="text-lg font-bold mt-0.5" style={{ color: "#fbbf24" }}>
                          ✦ R$ {saldoCredito.toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                      {!formas.includes("Crédito") && (
                        <button onClick={() => { toggleForma("Crédito"); setFormaIdx(FORMAS.indexOf("Crédito")) }}
                          className="text-xs font-bold px-3 py-1.5 rounded-xl"
                          style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>
                          Usar crédito
                        </button>
                      )}
                    </motion.div>
                  )}

                  {/* Aviso: crédito único — validação feita no advance */}
                  {formas.includes("Crédito") && formas.length === 1 && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-4 px-4 py-3 rounded-2xl"
                      style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}>
                      <p className="text-xs font-semibold" style={{ color: "#fbbf24" }}>
                        O valor total ({fmtBRL(totalFinal)}) será cobrado em crédito.
                      </p>
                    </motion.div>
                  )}
                  {/* Aviso: crédito + outras formas */}
                  {formas.includes("Crédito") && formas.length > 1 && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-4 px-4 py-3 rounded-2xl"
                      style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}>
                      <p className="text-xs font-semibold" style={{ color: "#fbbf24" }}>
                        Na próxima etapa você define quanto será pago em crédito.
                      </p>
                    </motion.div>
                  )}

                  {/* Hint teclado */}
                  <p className="mt-4 text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>
                    Use{" "}
                    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>←</kbd>
                    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>→</kbd>
                    para navegar na linha ·
                    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>↑</kbd>
                    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>↓</kbd>
                    para coluna ·
                    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>↵ Enter</kbd>
                    para confirmar
                  </p>
                </>}

                {/* ── Step 4: Divisão do pagamento ── */}
                {step === 4 && (() => {
                  const soma       = formas.reduce((s, f) => s + (divisao[f] ?? 0), 0)
                  const diff       = parseFloat((soma - totalFinal).toFixed(2))
                  const excedente  = diff > 0.01
                  const incompleto = diff < -0.01
                  const correto    = !excedente && !incompleto
                  const creditoInvalido = formas.includes("Crédito") && saldoCredito > 0 && (divisao["Crédito"] ?? 0) > saldoCredito
                  const temZero    = formas.some(f => (divisao[f] ?? 0) <= 0)
                  return <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Divisão do pagamento</h1>
                    <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>Informe quanto será pago em cada forma selecionada.</p>

                    {/* Painel resumo */}
                    <div className="mb-4 grid grid-cols-3 gap-3 px-4 py-3 rounded-2xl"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Total</p>
                        <p className="text-base font-bold" style={{ color: COR }}>{fmtBRL(totalFinal)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Distribuído</p>
                        <p className="text-base font-bold" style={{ color: excedente ? "#f87171" : correto && soma > 0 ? "#10b981" : "var(--text-primary)" }}>{fmtBRL(soma)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: excedente ? "#f87171" : incompleto ? "#fbbf24" : "var(--text-muted)" }}>
                          {excedente ? "Excedente" : incompleto ? "Falta" : "Falta"}
                        </p>
                        <p className="text-base font-bold" style={{ color: excedente ? "#f87171" : correto && soma > 0 ? "#10b981" : "#fbbf24" }}>
                          {correto && soma > 0 ? "✓ R$ 0,00" : excedente ? fmtBRL(diff) : fmtBRL(Math.abs(diff))}
                        </p>
                      </div>
                    </div>

                    {/* Banner de status em tempo real */}
                    <AnimatePresence mode="wait">
                      {creditoInvalido && (
                        <motion.div key="credito-inv"
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                          className="mb-4 flex items-start gap-2 px-4 py-3 rounded-2xl"
                          style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.4)" }}>
                          <span style={{ color: "#f87171", fontSize: 15 }}>⚠</span>
                          <p className="text-sm font-semibold" style={{ color: "#f87171" }}>
                            O valor em crédito ultrapassa o saldo disponível do cliente ({fmtBRL(saldoCredito)}).
                          </p>
                        </motion.div>
                      )}
                      {!creditoInvalido && excedente && (
                        <motion.div key="excedente"
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                          className="mb-4 flex items-start gap-2 px-4 py-3 rounded-2xl"
                          style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.4)" }}>
                          <span style={{ color: "#f87171", fontSize: 15 }}>⚠</span>
                          <p className="text-sm font-semibold" style={{ color: "#f87171" }}>
                            A soma ultrapassa o total da venda em {fmtBRL(diff)}. Ajuste os valores.
                          </p>
                        </motion.div>
                      )}
                      {!creditoInvalido && incompleto && soma > 0 && (
                        <motion.div key="incompleto"
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                          className="mb-4 flex items-start gap-2 px-4 py-3 rounded-2xl"
                          style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.4)" }}>
                          <span style={{ color: "#fbbf24", fontSize: 15 }}>◎</span>
                          <p className="text-sm font-semibold" style={{ color: "#fbbf24" }}>
                            Ainda falta distribuir {fmtBRL(Math.abs(diff))} para completar o total.
                          </p>
                        </motion.div>
                      )}
                      {!creditoInvalido && correto && soma > 0 && !temZero && (
                        <motion.div key="correto"
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                          className="mb-4 flex items-start gap-2 px-4 py-3 rounded-2xl"
                          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.4)" }}>
                          <span style={{ color: "#10b981", fontSize: 15 }}>✓</span>
                          <p className="text-sm font-semibold" style={{ color: "#10b981" }}>
                            Pagamento distribuído corretamente. Você pode continuar.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Inputs por forma */}
                    <div className="space-y-3">
                      {formas.map((f, i) => {
                        const isCredito  = f === "Crédito"
                        const maxCredito = isCredito ? Math.min(saldoCredito, totalFinal) : undefined
                        const val        = divisao[f] ?? 0
                        const strVal     = val > 0 ? String(val).replace(".", ",") : ""
                        const isErr      = isCredito && creditoInvalido
                        return (
                          <div key={f}>
                            <label className="text-xs font-bold uppercase tracking-wide block mb-1.5"
                              style={{ color: isErr ? "#f87171" : "var(--text-muted)" }}>
                              {f}{isCredito && saldoCredito > 0 ? ` (saldo: ${fmtBRL(saldoCredito)})` : ""}
                            </label>
                            <div className="relative">
                              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base font-bold select-none"
                                style={{ color: "var(--text-muted)" }}>R$</span>
                              <input
                                value={strVal}
                                autoFocus={i === 0}
                                onChange={e => {
                                  const raw = e.target.value.replace(",", ".")
                                  const parsed = parseFloat(raw)
                                  const newVal = isNaN(parsed) || parsed < 0 ? 0
                                    : maxCredito !== undefined ? Math.min(parsed, maxCredito)
                                    : parsed
                                  const updated = { ...divisao, [f]: parseFloat(newVal.toFixed(2)) }
                                  if (formas.length === 2 && i === 0) {
                                    const other = formas[1]
                                    const rem = Math.max(0, totalFinal - newVal)
                                    const otherMax = other === "Crédito" ? Math.min(saldoCredito, rem) : rem
                                    updated[other] = parseFloat(otherMax.toFixed(2))
                                  }
                                  setDivisao(updated)
                                }}
                                placeholder="0,00"
                                inputMode="decimal"
                                className={cn(iBase, "pl-12 text-base py-3")}
                                style={{ ...iSt, borderColor: isErr ? "#f87171" : val > 0 && correto ? "#10b98166" : "var(--border)" }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                })()}

                {/* ── Step 5: Desconto ── */}
                {step === 5 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Desconto geral?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Opcional — deixe em branco se não houver.</p>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-semibold" style={{ color: "var(--text-muted)" }}>R$</span>
                    <input ref={inputRef} value={desconto} onChange={e => setDesconto(e.target.value)}
                      type="number" step="0.01" min="0"
                      placeholder="0,00"
                      className={cn(iBase, "pl-14")} style={iSt} />
                  </div>
                  {descontoVal > 0 && (
                    <div className="mt-4 px-4 py-3 rounded-2xl space-y-1.5"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: "var(--text-muted)" }}>Total bruto</span>
                        <span style={{ color: "var(--text-primary)" }}>{fmtBRL(totalBruto)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: "#f87171" }}>Desconto</span>
                        <span style={{ color: "#f87171" }}>- {fmtBRL(descontoVal)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--text-primary)" }}>Total</span>
                        <span style={{ color: COR }}>{fmtBRL(totalFinal)}</span>
                      </div>
                    </div>
                  )}
                </>}

                {/* ── Step 6: Observações ── */}
                {step === 6 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Observações?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Opcional — anotações internas sobre esta venda.</p>
                  <textarea ref={obsRef} value={obs} onChange={e => setObs(e.target.value)} rows={4}
                    placeholder="Ex: CLIENTE RETIROU NA LOJA, PRODUTO ERA PRESENTE..."
                    className={cn(iBase, "resize-none !text-base leading-relaxed")} style={iSt} />
                </>}

                {/* Erro */}
                <AnimatePresence>
                  {erro && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-2 text-sm" style={{ color: "#f87171" }}>{erro}</motion.p>}
                </AnimatePresence>

                {(() => {
                  const div4Soma = formas.reduce((s, f) => s + (divisao[f] ?? 0), 0)
                  const div4Ok = step !== 4 || (
                    Math.abs(div4Soma - totalFinal) <= 0.01 &&
                    formas.every(f => (divisao[f] ?? 0) > 0) &&
                    (!formas.includes("Crédito") || (divisao["Crédito"] ?? 0) <= saldoCredito)
                  )
                  return (
                  <div className="flex items-center gap-4 mt-8">
                    <motion.button
                      whileHover={div4Ok ? { scale: 1.05, boxShadow: `0 8px 24px ${COR}55` } : {}}
                      whileTap={div4Ok ? { scale: 0.94 } : {}}
                      transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      onClick={advance}
                      disabled={!div4Ok}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg transition-opacity"
                      style={{ background: COR, opacity: div4Ok ? 1 : 0.4, cursor: div4Ok ? "pointer" : "not-allowed" }}>
                      {step === 1 ? "OK, continuar" : "Continuar"} <ArrowRight size={15} />
                    </motion.button>
                    {step > 1 && step !== 4 && (
                      <motion.button
                        whileHover={{ x: 3 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => step === 3 ? go(formas.length > 1 ? 4 : 5) : go(step + 1)}
                        className="text-sm font-medium transition-colors" style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                        Pular →
                      </motion.button>
                    )}
                  </div>
                  )
                })()}
              </div>
            </motion.div>

          ) : (
            /* ── Step 7: Revisão ── */
            <motion.div key="revisao" custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="absolute inset-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

              {/* Sidebar verde */}
              <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col items-center justify-between py-4 md:py-10 px-5 md:px-6 gap-4 md:gap-0"
                style={{ background: COR }}>
                {/* Info — row on mobile, column on desktop */}
                <div className="flex flex-row md:flex-col items-center gap-4 md:text-center">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-2xl flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.2)" }}>
                      <ShoppingCart size={22} color="#fff" className="md:hidden" />
                      <ShoppingCart size={32} color="#fff" className="hidden md:block" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center bg-white/90">
                      <Check size={10} style={{ color: COR }} className="md:hidden" />
                      <Check size={14} style={{ color: COR }} className="hidden md:block" />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-sm md:text-lg leading-tight text-white uppercase">{clienteNome || "CONSUMIDOR FINAL"}</p>
                    <p className="text-lg md:text-2xl font-bold text-white mt-0.5 md:mt-1">{fmtBRL(totalFinal)}</p>
                    <p className="text-xs mt-0.5 md:mt-1 hidden md:block" style={{ color: "rgba(255,255,255,0.65)" }}>Revise antes de finalizar</p>
                  </div>
                </div>
                {/* Buttons */}
                <div className="flex flex-row md:flex-col gap-2 md:w-full shrink-0">
                  <button onClick={handleSalvar} disabled={saving}
                    className="py-2.5 md:py-3 px-4 md:px-0 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 md:w-full"
                    style={{ background: "#fff", color: COR }}>
                    {saving ? <><Loader2 size={15} className="animate-spin" />Salvando...</> : "Finalizar"}
                  </button>
                  <button onClick={onClose} className="py-2.5 px-4 md:px-0 rounded-2xl text-sm font-medium md:w-full"
                    style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}>
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Painel revisão */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-10" style={{ background: "var(--bg-base)" }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-6" style={{ color: "var(--text-muted)" }}>
                  ◎ Resumo da Venda
                </h2>
                {erro && (
                  <p className="mb-4 text-sm px-4 py-2 rounded-xl"
                    style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>{erro}</p>
                )}

                {/* Itens */}
                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  Produtos
                </p>
                <div className="space-y-2 mb-6">
                  {itens.map((it, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 rounded-2xl"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${COR}` }}>
                      <div>
                        <p className="text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>{it.nome_produto}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{it.quantidade}x · {fmtBRL(it.preco_unitario)}</p>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {fmtBRL(it.preco_unitario * it.quantidade)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Demais campos */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Cliente",    value: clienteNome || "Consumidor Final", s: 1 },
                    {
                      label: "Pagamento",
                      value: formas.length === 1
                        ? formas[0]
                        : formas.map(f => `${f}: ${fmtBRL(divisao[f] ?? 0)}`).join(" · "),
                      s: 3,
                      full: formas.length > 1,
                    },
                    { label: "Desconto",   value: descontoVal > 0 ? fmtBRL(descontoVal) : "R$ 0,00", s: 5 },
                    { label: "Total",      value: fmtBRL(totalFinal),            s: null },
                    ...(obs ? [{ label: "Obs.", value: obs, s: 6, full: true }] : []),
                  ].map(({ label, value, s, full }) => (
                    <div key={label} className={cn("rounded-2xl p-4", full ? "col-span-2" : "")}
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${COR}` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="text-sm font-medium uppercase" style={{ color: label === "Total" ? COR : "var(--text-primary)" }}>{value}</p>
                      {s && (
                        <button onClick={() => go(s as number)} className="flex items-center gap-1 text-xs mt-1.5 transition-opacity"
                          style={{ color: COR }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.65" }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                          <Pencil size={9} /> EDITAR
                        </button>
                      )}
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
        <div className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}>
          {step > 1 ? (
            <button onClick={() => go(step === 5 && formas.length === 1 ? 3 : step - 1)}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)" }}>
              <ChevronLeft size={15} /> Voltar
            </button>
          ) : <span />}
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Pressione{" "}
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Enter
            </kbd>{" "}
            para avançar
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Página Principal ─────────────────────────────────────
export default function VendasPage() {
  const qc = useQueryClient()
  const [periodo, setPeriodo]     = useState("hoje")
  const [de, setDe]               = useState("")
  const [ate, setAte]             = useState("")
  const [showWizard, setWizard]   = useState(false)
  const [detalheId, setDetalheId] = useState<number | null>(null)

  const params = getPeriodoParams(periodo, de, ate)

  const { data, isLoading, isFetching, refetch } = useQuery<{ data: VendaListItem[]; total: number }>({
    queryKey: ["vendas", params],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: "100", ...params as Record<string, string> }).toString()
      return apiGet(`/vendas?${qs}`)
    },
    staleTime: 30_000,
  })

  const vendas   = data?.data ?? []
  const totalVal = vendas.reduce((s, v) => s + v.total, 0)

  const [tableFocused, setTableFocused] = useState(false)
  const { sel, onKeyDown: tableKeyDown, reset: resetSel } = useTableKeyNav(vendas, (v) => setDetalheId(v.id))

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>Vendas</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{data?.total ?? 0} registros</p>
        </div>
        <button onClick={() => setWizard(true)}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white shadow-lg transition-opacity"
          style={{ background: COR }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
          <Plus size={16} /> Nova Venda
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total do período", value: fmtBRL(totalVal),                                            color: COR,                    border: COR },
          { label: "Qtd. de vendas",   value: String(vendas.length),                                      color: "var(--accent)",         border: "var(--accent)" },
          { label: "Ticket médio",     value: vendas.length ? fmtBRL(totalVal / vendas.length) : "R$ 0,00", color: "var(--accent)",        border: "var(--accent)" },
          { label: "Última venda",     value: vendas[0] ? fmtData(vendas[0].data_venda) : "—",            color: "var(--text-secondary)", border: "var(--border-hover)" },
        ].map(({ label, value, color, border }) => (
          <motion.div key={label}
            whileHover={{ y: -2, boxShadow: "var(--shadow-md)" }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl p-5 cursor-default"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderTop: `3px solid ${border}`,
              boxShadow: "var(--shadow-sm)",
            }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</p>
            <p className="text-2xl font-bold mt-2 tabular-nums" style={{ color }}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filtros */}
      <div className="rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex gap-1.5">
          {PERIODO_OPTIONS.map(op => (
            <button key={op.key} onClick={() => setPeriodo(op.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all"
              style={{ background: periodo === op.key ? "var(--accent)" : "transparent", color: periodo === op.key ? "#fff" : "var(--text-secondary)" }}>
              {op.label}
            </button>
          ))}
        </div>
        {periodo === "custom" && (
          <div className="flex items-center gap-2">
            <DatePickerCompact value={de} onChange={v => setDe(v)} placeholder="De" />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>até</span>
            <DatePickerCompact value={ate} onChange={v => { setAte(v); refetch() }} placeholder="Até" />
          </div>
        )}
        <button onClick={() => refetch()}
          className={cn("ml-auto flex items-center gap-1.5 text-xs transition-colors", isFetching && "opacity-50")}
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          {isFetching ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div
          tabIndex={0}
          onKeyDown={tableKeyDown}
          onFocus={() => setTableFocused(true)}
          onBlur={() => { setTableFocused(false); resetSel() }}
          className="overflow-x-auto outline-none"
        >
          <table className="w-full min-w-[700px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["", "#", "Data", "Hora", "Itens", "Cliente", "Pagamento", "Total", "Notificações"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center">
                  <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "var(--accent)" }} />
                </td></tr>
              ) : vendas.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Nenhuma venda encontrada para este período.
                </td></tr>
              ) : vendas.map((v, idx) => (
                <tr key={v.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border)", background: sel === idx ? "var(--accent-bg)" : "transparent", borderLeft: sel === idx ? "3px solid var(--accent)" : "3px solid transparent", outline: "none" }}
                  onMouseEnter={e => { if (sel !== idx) (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)" }}
                  onMouseLeave={e => { if (sel !== idx) (e.currentTarget as HTMLTableRowElement).style.background = "transparent" }}>
                  <td className="px-4 py-3">
                    <button onClick={() => setDetalheId(v.id)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                      style={{ color: "var(--accent)", border: "1px solid var(--accent)", opacity: 0.7 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.7" }}>
                      VER
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm" style={{ color: "var(--text-secondary)" }}>#{v.numero}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{fmtData(v.data_venda)}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>{v.hora_venda?.slice(0,5) ?? "—"}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{v.qtd_itens ?? 0}</td>
                  <td className="px-4 py-3 text-sm uppercase" style={{ color: "var(--text-secondary)" }}>{v.cliente_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-sm uppercase" style={{ color: "var(--text-muted)" }}>{v.forma_pagamento ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: COR }}>{fmtBRL(v.total)}</td>
                  <td className="px-4 py-3"><BadgeNotif status={v.notificacao_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tableFocused && (
          <div className="px-4 py-2 flex items-center gap-3 border-t" style={{ borderColor: "var(--border)" }}>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 10 }}>↑↓</kbd>
              {" "}navegar{" · "}
              <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 10 }}>Enter</kbd>
              {" "}abrir{" · "}
              <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 10 }}>Esc</kbd>
              {" "}deselecionar
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showWizard && (
          <WizardNovaVenda
            onClose={() => setWizard(false)}
            onSalvo={() => { setWizard(false); qc.invalidateQueries({ queryKey: ["vendas"] }) }}
          />
        )}
        {detalheId !== null && <ModalDetalhe id={detalheId} onClose={() => setDetalheId(null)} />}
      </AnimatePresence>
    </div>
  )
}
