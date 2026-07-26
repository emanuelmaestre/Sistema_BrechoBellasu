"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  Plus, Search, X, Check,
  Loader2, RefreshCw,
  CheckCircle2, XCircle, Clock, Send, FileText, Printer, UserPlus, Maximize2, Copy, CheckCheck,
} from "lucide-react"
import { apiGet, apiPost, apiDelete } from "@/services/api"
import { SuccessOverlay } from "@/components/SuccessOverlay"
import { DatePickerCompact } from "@/components/DatePicker"
import { fmtBRL, fmtData, cn } from "@/lib/utils"
import type { Cliente, Produto } from "@/types"
import { useTableKeyNav, useDropdownKeyNav } from "@/hooks/useKeyNav"
import { gerarReciboPDF, imprimirRecibo } from "@/lib/recibo-pdf"
import { gerarPixPayload } from "@/lib/pix"
import QRCode from "react-qr-code"
import salesData from "@/data/ui/sales.json"

const FORMAS = salesData.paymentMethods
const PERIODO_OPTIONS = salesData.periodOptions


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
  itens: { nome_produto: string; codigo_produto?: string | null; quantidade: number; preco_unitario: number; subtotal: number; marca?: string | null }[]
}
interface WizItem {
  produto_id: number | null; nome_produto: string
  codigo_produto?: string | null
  quantidade: number; preco_unitario: number
  marca?: string | null
}
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
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {it.codigo_produto && <span className="font-mono mr-1.5">{it.codigo_produto}</span>}
                        {it.quantidade}x · {fmtBRL(it.preco_unitario)}
                      </p>
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
function PixCopiarChave({ chave, payload }: { chave: string; payload?: string }) {
  const [copiadoChave, setCopiadoChave] = useState(false)
  const [copiadoCod,   setCopiadoCod]   = useState(false)
  function copiarChave() {
    navigator.clipboard.writeText(chave)
    setCopiadoChave(true)
    setTimeout(() => setCopiadoChave(false), 2000)
  }
  function copiarCodigo() {
    if (!payload) return
    navigator.clipboard.writeText(payload)
    setCopiadoCod(true)
    setTimeout(() => setCopiadoCod(false), 2500)
  }
  return (
    <div className="w-full px-5 pb-4 space-y-2">
      {/* Chave PIX */}
      <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Chave PIX</p>
          <span className="text-xs font-mono truncate block" style={{ color: "var(--text-secondary)" }}>
            {chave}
          </span>
        </div>
        <button onClick={copiarChave}
          className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl shrink-0 transition-all"
          style={{ background: copiadoChave ? "rgba(16,185,129,0.15)" : "var(--accent-bg)", color: copiadoChave ? "#10b981" : "var(--accent)", border: `1px solid ${copiadoChave ? "rgba(16,185,129,0.4)" : "var(--accent)"}` }}>
          {copiadoChave ? <><CheckCheck size={11} /> Copiado!</> : <><Copy size={11} /> Copiar</>}
        </button>
      </div>
      {/* Copia e Cola PIX — código EMV completo */}
      {payload && (
        <button onClick={copiarCodigo}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-2xl text-[11px] font-bold transition-all"
          style={{
            background: copiadoCod ? "rgba(16,185,129,0.12)" : "rgba(99,102,241,0.06)",
            color: copiadoCod ? "#10b981" : "var(--text-muted)",
            border: `1px dashed ${copiadoCod ? "rgba(16,185,129,0.5)" : "var(--border)"}`,
          }}>
          {copiadoCod
            ? <><CheckCheck size={11} /> Código copiado! Cole no app do banco</>
            : <><Copy size={11} /> Copiar código PIX (copia e cola)</>
          }
        </button>
      )}
    </div>
  )
}

// ─── Wizard Nova Venda (tela única) ───────────────────────
function WizardNovaVenda({ onClose, onSalvo, initialCliente }: { onClose: () => void; onSalvo: () => void; initialCliente?: Cliente | null }) {
  const router = useRouter()
  const [erro, setErro]           = useState("")
  const [saving, setSaving]       = useState(false)
  const [salvoOk, setSalvoOk]     = useState(false)
  const [pixModal, setPixModal]   = useState(false)

  // Cliente
  const [clienteId, setClienteId]         = useState<number | null>(null)
  const [clienteNome, setClienteNome]     = useState("")
  const [clienteCelular, setClienteCelular] = useState<string | null>(null)
  const [cliBusca, setCliBusca]           = useState("")
  const [cliRes, setCliRes]               = useState<Cliente[]>([])
  const [saldoCredito, setSaldoCredito]   = useState(0)

  // Produtos
  const [itens, setItens]     = useState<WizItem[]>([])
  const [prodBusca, setProdBusca] = useState("")
  const [prodRes, setProdRes]     = useState<Produto[]>([])

  // Pagamento
  const [formas, setFormas]   = useState<string[]>(["Dinheiro"])
  const [divisao, setDivisao] = useState<Record<string, number>>({})
  const [desconto, setDesconto] = useState("")
  const [obs, setObs]           = useState("")

  const cliRef  = useRef<HTMLInputElement>(null)
  const prodRef = useRef<HTMLInputElement>(null)

  useEffect(() => { cliRef.current?.focus() }, [])

  useEffect(() => {
    if (initialCliente) selecionarCliente(initialCliente)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    setItens(prev => [...prev, { produto_id: p.id, nome_produto: p.nome, codigo_produto: (p as { codigo?: string | null }).codigo ?? null, quantidade: 1, preco_unitario: p.preco_venda ?? 0, marca: (p as { marca?: string }).marca ?? null }])
    setProdBusca(""); setProdRes([])
    setTimeout(() => prodRef.current?.focus(), 50)
  }

  function adicionarManual() {
    if (!prodBusca.trim()) return
    setItens(prev => [...prev, { produto_id: null, nome_produto: prodBusca.trim(), quantidade: 1, preco_unitario: 0 }])
    setProdBusca(""); setProdRes([])
  }

  function removerItem(i: number) { setItens(prev => prev.filter((_, idx) => idx !== i)) }

  function toggleForma(f: string) {
    setFormas(prev => prev.includes(f) ? (prev.length > 1 ? prev.filter(x => x !== f) : prev) : [...prev, f])
  }

  const { hi: cliHi, onKeyDown: cliDropKeyDown, reset: resetCliHi } = useDropdownKeyNav(cliRes, selecionarCliente)
  const { hi: prodHi, onKeyDown: prodDropKeyDown, reset: resetProdHi } = useDropdownKeyNav(prodRes, adicionarProduto)

  const descontoVal = parseFloat(desconto.replace(",", ".")) || 0
  const totalBruto  = itens.reduce((s, it) => s + it.preco_unitario * it.quantidade, 0)
  const totalFinal  = Math.max(0, totalBruto - descontoVal)

  // Divisão
  const divisaoSoma = formas.reduce((s, f) => s + (divisao[f] ?? 0), 0)
  const divisaoDiff = parseFloat((divisaoSoma - totalFinal).toFixed(2))
  const divisaoOk   = formas.length <= 1 || (
    Math.abs(divisaoDiff) <= 0.01 &&
    formas.every(f => (divisao[f] ?? 0) > 0) &&
    (!formas.includes("Crédito") || (divisao["Crédito"] ?? 0) <= saldoCredito)
  )

  async function handleSalvar() {
    if (itens.length === 0) { setErro("Adicione pelo menos um produto"); return }
    if (formas.length > 1 && !divisaoOk) { setErro("Distribua o pagamento antes de salvar"); return }
    if (formas.length === 1 && formas[0] === "Crédito" && totalFinal > saldoCredito) {
      setErro(`Crédito insuficiente. Disponível: ${fmtBRL(saldoCredito)}`); return
    }
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

      if (res.id && clienteId) {
        try {
          const pdfBlob = await gerarReciboPDF({
            numero: res.id, tipo: "Venda",
            data: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            cliente_nome: clienteNome || "Cliente",
            cliente_celular: clienteCelular ?? "",
            itens: itens.map(it => ({ nome: it.nome_produto, qtd: it.quantidade, preco_unit: it.preco_unitario, subtotal: it.preco_unitario * it.quantidade, marca: it.marca ?? null })),
            forma_pagamento: formas.join(" + "),
            desconto: descontoVal,
            total: totalFinal,
          })
          const arrayBuffer = await pdfBlob.arrayBuffer()
          const uint8 = new Uint8Array(arrayBuffer)
          let binary = ""
          for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i])
          const base64 = btoa(binary)
          apiPost(`/vendas/${res.id}/recibo`, { pdfBase64: base64, reenviar: false }).catch(() => {})
        } catch { /* PDF failure doesn't cancel the sale */ }
      }

      setSalvoOk(true)
      setTimeout(() => { setSalvoOk(false); onSalvo() }, 2200)
    } catch (e: unknown) {
      setErro((e as Error).message || "Erro ao registrar venda.")
    } finally { setSaving(false) }
  }

  const iBase = "w-full px-3 py-2 text-sm rounded-xl outline-none transition-all border focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }
  const lSt  = "block text-[10px] font-bold uppercase tracking-wider mb-1"
  const lCol: React.CSSProperties = { color: "var(--text-muted)" }

  // PIX
  const pixChave = process.env.NEXT_PUBLIC_PIX_KEY ?? "+5516991347476"
  const temPix   = formas.some(f => f.toUpperCase().includes("PIX"))
  const valorPix = formas.length === 1 ? totalFinal : (divisao["PIX"] ?? divisao[formas.find(f => f.toUpperCase().includes("PIX")) ?? ""] ?? 0)
  const pixPayload = temPix ? gerarPixPayload({ chave: pixChave, nome: "Brecho Bellasu", cidade: "Ribeirao Preto", valor: valorPix > 0 ? valorPix : undefined }) : ""

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>
      <SuccessOverlay show={salvoOk} titulo="Venda registrada!" subtitulo={clienteNome || "Consumidor Final"} />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: COR }}>Brechó Bellasu</span>
          <span style={{ color: "var(--border-hover)" }}>|</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Nova Venda</span>
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
          <X size={15} /> Cancelar
        </button>
      </div>

      {/* Body — 2 columns */}
      <div className="flex-1 overflow-hidden flex gap-0">

        {/* ── Col esquerda: Cliente + Produtos ── */}
        <div className="flex-1 flex flex-col gap-3 p-5 overflow-y-auto border-r" style={{ borderColor: "var(--border)" }}>

          {/* Cliente */}
          <div>
            <label className={lSt} style={lCol}>Cliente (opcional)</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input ref={cliRef} value={cliBusca}
                onChange={e => { buscarClientes(e.target.value); resetCliHi() }}
                onKeyDown={cliDropKeyDown}
                placeholder="Nome, CPF, WhatsApp ou @Instagram"
                className={cn(iBase, "pl-8")} style={iSt} autoComplete="off" />
            </div>
            {cliRes.length > 0 && (
              <div className="mt-1 rounded-xl overflow-hidden shadow-lg" style={{ border: "1px solid var(--border)" }}>
                {cliRes.map((c, idx) => (
                  <button key={c.id} onClick={() => selecionarCliente(c)}
                    className="w-full px-3 py-2 text-left transition-colors"
                    style={{ borderBottom: "1px solid var(--border)", background: cliHi === idx ? "var(--accent-bg)" : "transparent" }}
                    onMouseEnter={e => { if (cliHi !== idx) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                    onMouseLeave={e => { if (cliHi !== idx) (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                    <p className="text-sm font-medium uppercase" style={{ color: cliHi === idx ? "var(--accent)" : "var(--text-primary)" }}>{c.nome}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.celular ?? "Sem WhatsApp"}</p>
                  </button>
                ))}
              </div>
            )}
            {clienteId && (
              <div className="mt-1.5 px-3 py-2 rounded-xl flex items-center justify-between"
                style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.35)" }}>
                <div className="flex items-center gap-2">
                  <Check size={13} style={{ color: COR }} />
                  <span className="text-sm font-bold uppercase" style={{ color: COR }}>{clienteNome}</span>
                  {saldoCredito > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>
                      ✦ {fmtBRL(saldoCredito)} crédito
                    </span>
                  )}
                </div>
                <button onClick={() => { setClienteId(null); setClienteNome(""); setCliBusca(""); setSaldoCredito(0); setTimeout(() => cliRef.current?.focus(), 50) }}
                  className="text-xs transition-colors" style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                  <X size={13} />
                </button>
              </div>
            )}
            {cliBusca.length >= 2 && cliRes.length === 0 && !clienteId && (
              <div className="mt-1.5 flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Sem resultado para &ldquo;{cliBusca}&rdquo;
                </p>
                <button onClick={() => router.push(`/clientes?novo=1&from=vendas&nome=${encodeURIComponent(cliBusca)}`)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                  style={{ background: COR }}>
                  <UserPlus size={11} /> Cadastrar
                </button>
              </div>
            )}
          </div>

          {/* Produtos */}
          <div className="flex-1 flex flex-col min-h-0">
            <label className={lSt} style={lCol}>Produtos *</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input ref={prodRef} value={prodBusca}
                onChange={e => { buscarProdutos(e.target.value); resetProdHi() }}
                onKeyDown={prodDropKeyDown}
                placeholder="Buscar produto por nome"
                className={cn(iBase, "pl-8")} style={iSt} autoComplete="off" />
            </div>
            {(prodRes.length > 0 || prodBusca.length >= 2) && (
              <div className="mt-1 rounded-xl overflow-hidden shadow-lg" style={{ border: "1px solid var(--border)" }}>
                {prodRes.map((p, idx) => (
                  <button key={p.id} onClick={() => adicionarProduto(p)}
                    className="w-full px-3 py-2 text-left transition-colors"
                    style={{ borderBottom: "1px solid var(--border)", background: prodHi === idx ? "var(--accent-bg)" : "transparent" }}
                    onMouseEnter={e => { if (prodHi !== idx) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                    onMouseLeave={e => { if (prodHi !== idx) (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                    <p className="text-sm font-medium uppercase" style={{ color: prodHi === idx ? "var(--accent)" : "var(--text-primary)" }}>{p.nome}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtBRL(p.preco_venda)} · Estoque: {p.estoque_atual ?? "—"}</p>
                  </button>
                ))}
                {prodBusca.length >= 2 && (
                  <button onClick={adicionarManual}
                    className="w-full px-3 py-2 text-left text-xs font-semibold transition-colors"
                    style={{ color: COR }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                    + Adicionar &ldquo;{prodBusca}&rdquo; manualmente
                  </button>
                )}
              </div>
            )}
            {/* Items list */}
            <div className="mt-2 flex-1 overflow-y-auto space-y-1.5 min-h-0">
              {itens.length === 0 && (
                <p className="text-xs py-3 text-center" style={{ color: "var(--text-muted)" }}>Nenhum produto adicionado</p>
              )}
              {itens.map((it, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate uppercase" style={{ color: "var(--text-primary)" }}>{it.nome_produto}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {it.codigo_produto && <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{it.codigo_produto}</span>}
                      <input type="number" min={1} value={it.quantidade}
                        onChange={e => setItens(prev => prev.map((x, j) => j === i ? { ...x, quantidade: Math.max(1, parseInt(e.target.value) || 1) } : x))}
                        className="w-12 text-center text-xs rounded-lg border outline-none px-1 py-0.5"
                        style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>×</span>
                      <input type="text" value={it.preco_unitario > 0 ? String(it.preco_unitario).replace(".", ",") : ""}
                        onChange={e => setItens(prev => prev.map((x, j) => j === i ? { ...x, preco_unitario: parseFloat(e.target.value.replace(",", ".")) || 0 } : x))}
                        placeholder="R$ 0,00"
                        className="w-20 text-xs rounded-lg border outline-none px-1.5 py-0.5"
                        style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold shrink-0" style={{ color: COR }}>
                    {fmtBRL(it.preco_unitario * it.quantidade)}
                  </span>
                  <button onClick={() => removerItem(i)} className="p-1 rounded-lg transition-colors shrink-0"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Col direita: Pagamento + Desconto + Obs ── */}
        <div className="flex-1 flex flex-col gap-3 p-5 overflow-y-auto" style={{ minWidth: 320 }}>

          {/* Forma de pagamento */}
          <div>
            <label className={lSt} style={lCol}>Pagamento</label>
            {saldoCredito > 0 && (
              <div className="mb-2 px-3 py-1.5 rounded-xl flex items-center justify-between"
                style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}>
                <span className="text-xs font-bold" style={{ color: "#fbbf24" }}>✦ Crédito disponível: {fmtBRL(saldoCredito)}</span>
                {!formas.includes("Crédito") && (
                  <button onClick={() => toggleForma("Crédito")}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>Usar</button>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {FORMAS.map(f => {
                const sel = formas.includes(f)
                return (
                  <button key={f} onClick={() => toggleForma(f)}
                    className="py-2 px-3 rounded-xl text-xs font-bold text-left uppercase transition-all border"
                    style={{
                      background: sel ? `${COR}18` : "var(--bg-surface)",
                      borderColor: sel ? COR : "var(--border)",
                      color: sel ? COR : "var(--text-primary)",
                    }}>
                    <span className="flex items-center justify-between">
                      {f}
                      {sel && <Check size={11} style={{ color: COR }} />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Divisão — só quando 2+ formas */}
          {formas.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={lSt} style={lCol}>Divisão</label>
                <span className="text-[10px] font-bold" style={{ color: Math.abs(divisaoDiff) <= 0.01 ? "#10b981" : "#fbbf24" }}>
                  {Math.abs(divisaoDiff) <= 0.01 ? "✓ ok" : divisaoDiff < 0 ? `falta ${fmtBRL(Math.abs(divisaoDiff))}` : `excede ${fmtBRL(divisaoDiff)}`}
                </span>
              </div>
              <div className="space-y-1.5">
                {formas.map((f, i) => {
                  const isCredito = f === "Crédito"
                  const maxCredito = isCredito ? Math.min(saldoCredito, totalFinal) : undefined
                  const val = divisao[f] ?? 0
                  return (
                    <div key={f} className="flex items-center gap-2">
                      <span className="text-xs font-semibold w-20 shrink-0 truncate" style={{ color: "var(--text-secondary)" }}>{f}</span>
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>R$</span>
                        <input type="text" inputMode="decimal"
                          value={val > 0 ? String(val).replace(".", ",") : ""}
                          onChange={e => {
                            const raw = e.target.value.replace(",", ".")
                            const parsed = parseFloat(raw)
                            const newVal = isNaN(parsed) || parsed < 0 ? 0 : maxCredito !== undefined ? Math.min(parsed, maxCredito) : parsed
                            const updated = { ...divisao, [f]: parseFloat(newVal.toFixed(2)) }
                            if (formas.length === 2 && i === 0) {
                              const other = formas[1]; const rem = Math.max(0, totalFinal - newVal)
                              const otherMax = other === "Crédito" ? Math.min(saldoCredito, rem) : rem
                              updated[other] = parseFloat(otherMax.toFixed(2))
                            }
                            setDivisao(updated)
                          }}
                          placeholder="0,00"
                          className={cn(iBase, "pl-8")}
                          style={{ ...iSt, borderColor: isCredito && (divisao["Crédito"] ?? 0) > saldoCredito ? "#f87171" : "var(--border)" }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Desconto */}
          <div>
            <label className={lSt} style={lCol}>Desconto (opcional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>R$</span>
              <input type="text" inputMode="decimal" value={desconto}
                onChange={e => setDesconto(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="0,00" className={cn(iBase, "pl-9")} style={iSt} />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className={lSt} style={lCol}>Observações (opcional)</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Ex: CLIENTE RETIROU NA LOJA..."
              className={cn(iBase, "resize-none leading-relaxed")} style={iSt} />
          </div>

          {/* PIX QR inline */}
          {temPix && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1.5px solid rgba(99,102,241,0.35)", background: "var(--bg-surface)" }}>
              <div className="px-3 py-2 flex items-center gap-2"
                style={{ background: "rgba(99,102,241,0.08)", borderBottom: "1px solid rgba(99,102,241,0.2)" }}>
                <span className="text-sm">💠</span>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--accent)" }}>QR Code PIX</span>
                <span className="ml-auto text-xs font-bold" style={{ color: "var(--accent)" }}>
                  {valorPix > 0 ? fmtBRL(valorPix) : "Valor livre"}
                </span>
              </div>
              <div className="flex items-center gap-3 p-3">
                <button onClick={() => setPixModal(true)} className="shrink-0 p-2 rounded-xl relative group" style={{ background: "#fff" }} title="Expandir QR Code">
                  <QRCode value={pixPayload} size={64} />
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.4)" }}>
                    <Maximize2 size={16} color="#fff" />
                  </div>
                </button>
                <div>
                  <p className="text-xs font-bold mb-0.5" style={{ color: "var(--text-primary)" }}>Mostre para a cliente escanear</p>
                  <button onClick={() => setPixModal(true)} className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                    <Maximize2 size={10} className="inline mr-1" /> Expandir
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Erro */}
          {erro && <p className="text-xs" style={{ color: "#f87171" }}>{erro}</p>}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Total + Salvar */}
          <div className="space-y-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="space-y-0.5 text-xs">
              {descontoVal > 0 && (
                <>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-muted)" }}>Subtotal</span>
                    <span style={{ color: "var(--text-primary)" }}>{fmtBRL(totalBruto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#f87171" }}>Desconto</span>
                    <span style={{ color: "#f87171" }}>- {fmtBRL(descontoVal)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-sm">
                <span style={{ color: "var(--text-primary)" }}>Total</span>
                <span style={{ color: COR }}>{fmtBRL(totalFinal)}</span>
              </div>
            </div>
            <button onClick={handleSalvar} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity disabled:opacity-50"
              style={{ background: COR }}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><Check size={14} /> Registrar venda</>}
            </button>
          </div>
        </div>
      </div>

      {/* PIX Modal fullscreen */}
      <AnimatePresence>
        {pixModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
            onClick={() => setPixModal(false)}>
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.88, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="w-full max-w-sm rounded-3xl overflow-hidden flex flex-col items-center"
              style={{ background: "var(--bg-card)", border: "1.5px solid rgba(99,102,241,0.4)" }}
              onClick={e => e.stopPropagation()}>
              <div className="w-full flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">💠</span>
                  <span className="text-sm font-black uppercase tracking-widest" style={{ color: "var(--accent)" }}>PIX</span>
                </div>
                <button onClick={() => setPixModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>
                  <X size={15} />
                </button>
              </div>
              <div className="pt-5 pb-3 text-center">
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Total a receber</p>
                <p className="text-4xl font-black" style={{ color: "var(--accent)", letterSpacing: "-1px" }}>
                  {valorPix > 0 ? fmtBRL(valorPix) : "Valor livre"}
                </p>
              </div>
              <div className="p-5">
                <div className="p-4 rounded-2xl" style={{ background: "#fff" }}>
                  <QRCode value={pixPayload} size={Math.min(260, typeof window !== "undefined" ? window.innerWidth - 100 : 260)} />
                </div>
              </div>
              <PixCopiarChave chave={pixChave} payload={pixPayload} />
              <p className="text-[10px] pb-5 px-6 text-center" style={{ color: "var(--text-muted)" }}>
                Aponte a câmera do app do banco para o QR Code acima
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Página Principal ─────────────────────────────────────
function VendasPageInner() {
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [periodo, setPeriodo]     = useState("hoje")
  const [de, setDe]               = useState("")
  const [ate, setAte]             = useState("")
  const [showWizard, setWizard]   = useState(false)
  const [detalheId, setDetalheId] = useState<number | null>(null)
  const [initialCliente, setInitialCliente] = useState<Cliente | null>(null)

  useEffect(() => {
    const cliId = searchParams.get("cliente_id")
    if (!cliId) return
    router.replace("/vendas", { scroll: false })
    apiGet<Cliente>(`/clientes/${cliId}`)
      .then(c => { setInitialCliente(c); setWizard(true) })
      .catch(() => setWizard(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
            onClose={() => { setWizard(false); setInitialCliente(null) }}
            onSalvo={() => { setWizard(false); setInitialCliente(null); qc.invalidateQueries({ queryKey: ["vendas"] }) }}
            initialCliente={initialCliente}
          />
        )}
        {detalheId !== null && <ModalDetalhe id={detalheId} onClose={() => setDetalheId(null)} />}
      </AnimatePresence>
    </div>
  )
}

export default function VendasPage() {
  return (
    <Suspense>
      <VendasPageInner />
    </Suspense>
  )
}
