"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "motion/react"
import {
  ShieldAlert, Printer, ArrowLeft, Search, AlertTriangle, Ban, AlertCircle,
  MessageCircle, X, Trash2, Loader2, CheckSquare, Square, Send, Clock,
} from "lucide-react"
import Link from "next/link"
import { apiGet, apiPatch } from "@/services/api"
import type { GrauPenalidade } from "@/domain/live/penalidade"
import { cn } from "@/lib/utils"
import liveUiData from "@/data/ui/live.json"
import { useDisparoStore, type PenalidadeItem } from "@/stores/disparo.store"

const GRAU_CONFIG: Record<GrauPenalidade, { label: string; cor: string; bg: string; border: string }> =
  Object.fromEntries(Object.entries(liveUiData.penaltyUi).map(([grau, config]) => [
    grau,
    {
      label: config.label,
      cor: config.adminText,
      bg: config.adminBg,
      border: config.adminBorder,
    },
  ])) as Record<GrauPenalidade, { label: string; cor: string; bg: string; border: string }>
const MOTIVO_LABEL = Object.fromEntries(
  liveUiData.penaltyReasons.map((reason) => [reason.value, reason.label])
) as Record<string, string>
const MOTIVOS_REMOCAO = liveUiData.penaltyRemovalReasons

interface ClientePenalizado {
  id: number
  nome: string
  instagram?: string | null
  celular?: string | null
  apelido?: string | null
  total_penalidades_ativas: number
  grau: string
  ultimo_motivo?: string | null
  penalidade_ids: number[]
  penalidade_aviso_em?: string | null
}

function imprimirListaPenalidades(clientes: ClientePenalizado[]) {
  const data = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  const linhas = clientes.map((c, i) => {
    const motivoLabel = c.ultimo_motivo ? (MOTIVO_LABEL[c.ultimo_motivo] ?? c.ultimo_motivo) : "—"
    const corHex = liveUiData.penaltyUi[c.grau as keyof typeof liveUiData.penaltyUi]?.cor ?? "#d97706"
    return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#111;">${i + 1}. ${c.nome.toUpperCase()}${c.apelido ? ` (${c.apelido})` : ""}</td>
        <td style="padding:10px 12px;font-size:12px;color:#6b7280;">${c.instagram ? `@${c.instagram.replace(/^@/, "")}` : "—"}</td>
        <td style="padding:10px 12px;font-size:12px;color:#6b7280;">${c.celular ?? "—"}</td>
        <td style="padding:10px 12px;text-align:center;">
          <span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase;background:${corHex}18;color:${corHex};">
            ${c.grau} (${c.total_penalidades_ativas})
          </span>
        </td>
        <td style="padding:10px 12px;font-size:11px;color:#9ca3af;">${motivoLabel}</td>
      </tr>`
  }).join("")

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Lista de Penalidades — Brechó Bellasu</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111;padding:32px}
  @media print{body{padding:16px}.no-print{display:none!important}}
  h1{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
  table{width:100%;border-collapse:collapse;margin-top:20px}
  thead tr{background:#111}
  thead th{padding:10px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#fff;text-align:left}
  tbody tr:nth-child(even){background:#f9fafb}
  tfoot td{padding:8px 12px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb}
</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:4px">
    <div><h1>⚠️ Clientes com Penalidades</h1><p style="font-size:11px;color:#6b7280;margin-top:4px">Brechó Bellasu — Módulo Live</p></div>
    <div style="text-align:right">
      <p style="font-size:11px;color:#9ca3af">Gerado em ${data}</p>
      <p style="font-size:13px;font-weight:700;color:#dc2626">${clientes.length} cliente${clientes.length !== 1 ? "s" : ""} penalizada${clientes.length !== 1 ? "s" : ""}</p>
    </div>
  </div>
  <table>
    <thead><tr><th>Nome</th><th>Instagram</th><th>WhatsApp</th><th style="text-align:center">Status</th><th>Último motivo</th></tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr><td colspan="5">🟡 Advertida = 1 penalidade &nbsp;|&nbsp; 🟠 Restrita = 2 &nbsp;|&nbsp; 🔴 Bloqueada = 3+ (impede contemplação)</td></tr></tfoot>
  </table>
</body></html>`

  const w = window.open("", "_blank", "width=900,height=700")
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 600)
}

// ── Ícone por grau ─────────────────────────────────────────
function GrauIcon({ grau, size = 16 }: { grau: string; size?: number }) {
  if (grau === "bloqueada") return <Ban size={size} />
  if (grau === "restrita")  return <AlertTriangle size={size} />
  return <AlertCircle size={size} />
}

function digitsOnly(v: string): string { return v.replace(/\D/g, "") }

function tempoDesde(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const dias = Math.floor(ms / 86_400_000)
  if (dias <= 0) return "hoje"
  if (dias === 1) return "há 1 dia"
  return `há ${dias} dias`
}

// ── Contadores de grau no topo ─────────────────────────────
function StatCard({ grau, count, delay }: { grau: "advertida" | "restrita" | "bloqueada"; count: number; delay: number }) {
  const cfg = GRAU_CONFIG[grau]
  const corMap: Record<string, string> = { advertida: "#d97706", restrita: "#ea580c", bloqueada: "#dc2626" }
  const cor = corMap[grau]
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 24 }}
      className="flex-1 rounded-2xl px-4 py-4 flex flex-col items-center justify-center gap-1 min-w-[90px]"
      style={{ background: `${cor}10`, border: `1.5px solid ${cor}30` }}>
      <GrauIcon grau={grau} size={18} />
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.15 }}
        className="text-3xl font-black tabular-nums" style={{ color: cor }}>
        {count}
      </motion.p>
      <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: `${cor}99` }}>{cfg.label}</p>
    </motion.div>
  )
}

// ── Ilustração estado vazio ────────────────────────────────
function EmptyIllustration({ busca }: { busca: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="py-20 flex flex-col items-center gap-4">
      <div className="relative">
        {/* Círculos concêntricos animados */}
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.12, 0.06, 0.12] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full"
          style={{ background: "#10b981", margin: "-20px" }}
        />
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.18, 0.08, 0.18] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          className="absolute inset-0 rounded-full"
          style={{ background: "#10b981", margin: "-10px" }}
        />
        <div className="relative w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(16,185,129,0.12)", border: "2px solid rgba(16,185,129,0.3)" }}>
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
            <ShieldAlert size={36} style={{ color: "#10b981" }} />
          </motion.div>
        </div>
      </div>
      <div className="text-center space-y-1 mt-4">
        <p className="font-black text-base uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
          {busca ? "Nenhuma cliente encontrada" : "Tudo limpo!"}
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {busca ? "Tente outro nome ou Instagram" : "Nenhuma cliente com penalidades ativas no momento"}
        </p>
      </div>
    </motion.div>
  )
}

// ── Modal: enviar aviso via WhatsApp ────────────────────────
function ModalEnviarAviso({ clientes, onClose, onEnviar }: {
  clientes: ClientePenalizado[]
  onClose: () => void
  onEnviar: (itens: PenalidadeItem[]) => void
}) {
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set(clientes.map(c => c.id)))
  const [telefones, setTelefones] = useState<Record<number, string>>(
    Object.fromEntries(clientes.map(c => [c.id, c.celular ?? ""]))
  )

  const toggle = (id: number) => setSelecionados(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const selecionadosLista = clientes.filter(c => selecionados.has(c.id))
  const bloqueadasSelecionadas = selecionadosLista.filter(c => c.grau === "bloqueada").length
  const semTelefoneValido = selecionadosLista.filter(c => digitsOnly(telefones[c.id] ?? "").length < 10)
  const podeEnviar = selecionadosLista.length > 0 && semTelefoneValido.length === 0

  function confirmar() {
    if (!podeEnviar) return
    const itens: PenalidadeItem[] = selecionadosLista.map(c => ({
      id: c.id, nome: c.nome, celular: digitsOnly(telefones[c.id] ?? ""),
    }))
    onEnviar(itens)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1.5px solid rgba(16,185,129,0.3)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: "rgba(16,185,129,0.06)", borderBottom: "1px solid rgba(16,185,129,0.15)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle size={17} style={{ color: "#10b981" }} />
            <div className="min-w-0">
              <p className="font-black text-sm" style={{ color: "var(--text-primary)" }}>Enviar aviso via WhatsApp</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Revise os números antes de enviar</p>
            </div>
          </div>
          <button onClick={onClose}><X size={16} style={{ color: "var(--text-muted)" }} /></button>
        </div>

        {/* Lista de clientes */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {clientes.map(c => {
            const marcado = selecionados.has(c.id)
            const telInvalido = marcado && digitsOnly(telefones[c.id] ?? "").length < 10
            const cfg = GRAU_CONFIG[c.grau as keyof typeof GRAU_CONFIG] ?? GRAU_CONFIG.advertida
            return (
              <div key={c.id} className="flex items-start gap-3 px-3 py-3 rounded-2xl"
                style={{ background: "var(--bg-surface)", border: `1.5px solid ${telInvalido ? "rgba(239,68,68,0.4)" : "var(--border)"}` }}>
                <button onClick={() => toggle(c.id)} className="mt-0.5 shrink-0">
                  {marcado
                    ? <CheckSquare size={18} style={{ color: "#10b981" }} />
                    : <Square size={18} style={{ color: "var(--text-muted)" }} />}
                </button>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{c.nome}</p>
                    <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full", cfg.bg, cfg.cor)}>{cfg.label}</span>
                    {c.penalidade_aviso_em && (
                      <span className="text-[10px] inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                        <Clock size={10} /> avisada {tempoDesde(c.penalidade_aviso_em)}
                      </span>
                    )}
                  </div>
                  <input
                    value={telefones[c.id] ?? ""}
                    onChange={e => setTelefones(prev => ({ ...prev, [c.id]: e.target.value }))}
                    disabled={!marcado}
                    placeholder="WhatsApp com DDD, ex: 16991234567"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none transition-all disabled:opacity-40"
                    style={{ background: "var(--bg-base)", border: `1px solid ${telInvalido ? "#ef4444" : "var(--border)"}`, color: "var(--text-primary)" }}
                  />
                  {telInvalido && (
                    <p className="text-[10px] font-semibold" style={{ color: "#f87171" }}>Número inválido — confira o DDD.</p>
                  )}
                  {!c.celular && marcado && !telInvalido && (
                    <p className="text-[10px]" style={{ color: "#f59e0b" }}>Cadastro sem WhatsApp — este número vai corrigir o cadastro.</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Resumo + confirmação */}
        <div className="px-5 py-4 space-y-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <ShieldAlert size={14} style={{ color: "#10b981" }} className="shrink-0" />
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Você está prestes a avisar <b style={{ color: "var(--text-primary)" }}>{selecionadosLista.length}</b> cliente{selecionadosLista.length !== 1 ? "s" : ""}
              {bloqueadasSelecionadas > 0 && <>, sendo <b style={{ color: "#ef4444" }}>{bloqueadasSelecionadas} bloqueada{bloqueadasSelecionadas !== 1 ? "s" : ""}</b></>}.
              Envio organizado, com intervalo seguro entre mensagens e saudação variada.
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>Cancelar</button>
            <button onClick={confirmar} disabled={!podeEnviar}
              className="flex-1 py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
              <Send size={14} /> Enviar {selecionadosLista.length > 0 ? `(${selecionadosLista.length})` : ""}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Modal: remover penalidade(s) ────────────────────────────
function ModalRemoverPenalidade({ clientes, onClose, onRemovido }: {
  clientes: ClientePenalizado[]
  onClose: () => void
  onRemovido: () => void
}) {
  const [modoLote, setModoLote] = useState(true)
  const [motivoLote, setMotivoLote] = useState<string | null>(null)
  const [motivosIndividuais, setMotivosIndividuais] = useState<Record<number, string | null>>(
    Object.fromEntries(clientes.map(c => [c.id, null]))
  )
  const [detalhe, setDetalhe] = useState("")
  const [erro, setErro] = useState("")

  const mutation = useMutation({
    mutationFn: async () => {
      for (const c of clientes) {
        const grupo = modoLote ? motivoLote : motivosIndividuais[c.id]
        for (const penalidadeId of c.penalidade_ids) {
          await apiPatch(`/clientes/${c.id}/penalidades/${penalidadeId}`, {
            motivo_remocao: detalhe.trim() || undefined,
            motivo_remocao_grupo: grupo ?? undefined,
          })
        }
      }
    },
    onSuccess: onRemovido,
    onError: (e) => setErro(e instanceof Error ? e.message : "Erro ao remover penalidade."),
  })

  const motivoFaltando = modoLote
    ? !motivoLote
    : clientes.some(c => !motivosIndividuais[c.id])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1.5px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <Trash2 size={17} style={{ color: "var(--text-secondary)" }} />
            <div className="min-w-0">
              <p className="font-black text-sm" style={{ color: "var(--text-primary)" }}>Remover penalidade</p>
              <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                {clientes.length === 1 ? clientes[0].nome : `${clientes.length} clientes selecionadas`}
              </p>
            </div>
          </div>
          <button onClick={onClose}><X size={16} style={{ color: "var(--text-muted)" }} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {clientes.length > 1 && (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: "var(--bg-surface)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Mesmo motivo para todas</p>
              <button onClick={() => setModoLote(v => !v)}
                className="w-10 h-6 rounded-full relative transition-all"
                style={{ background: modoLote ? "#10b981" : "var(--border)" }}>
                <motion.div className="w-4 h-4 rounded-full bg-white absolute top-1"
                  animate={{ left: modoLote ? 20 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              </button>
            </div>
          )}

          {modoLote ? (
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Motivo</p>
              {MOTIVOS_REMOCAO.map(m => {
                const ativo = motivoLote === m.value
                return (
                  <button key={m.value} onClick={() => setMotivoLote(m.value)}
                    className="w-full text-left px-4 py-3 rounded-2xl transition-all flex items-start gap-3"
                    style={{ background: ativo ? "rgba(16,185,129,0.08)" : "var(--bg-surface)", border: `1.5px solid ${ativo ? "rgba(16,185,129,0.4)" : "var(--border)"}` }}>
                    <span className="text-base shrink-0">{m.emoji}</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{m.label}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{m.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {clientes.map(c => (
                <div key={c.id} className="space-y-1.5">
                  <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{c.nome}</p>
                  <select
                    value={motivosIndividuais[c.id] ?? ""}
                    onChange={e => setMotivosIndividuais(prev => ({ ...prev, [c.id]: e.target.value || null }))}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    <option value="">Selecione o motivo…</option>
                    {MOTIVOS_REMOCAO.map(m => (
                      <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Detalhe (opcional)</p>
            <textarea value={detalhe} onChange={e => setDetalhe(e.target.value)} rows={2}
              placeholder="Algo a mais que valha registrar…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none transition-all border"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
          </div>

          {erro && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(239,68,68,0.08)" }}>
              <AlertTriangle size={13} style={{ color: "#f87171" }} />
              <p className="text-xs font-semibold" style={{ color: "#f87171" }}>{erro}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-5 pt-0 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={motivoFaltando || mutation.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#6b7280,#374151)" }}>
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Remover {clientes.length > 1 ? `(${clientes.length})` : ""}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function PenalidadesPage() {
  const [busca, setBusca] = useState("")
  const [modoSelecao, setModoSelecao] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [modalEnvio, setModalEnvio] = useState<ClientePenalizado[] | null>(null)
  const [modalRemocao, setModalRemocao] = useState<ClientePenalizado[] | null>(null)

  const qc = useQueryClient()
  const iniciarPenalidade = useDisparoStore((s) => s.iniciarPenalidade)

  const { data, isLoading } = useQuery<{ data: ClientePenalizado[]; total: number }>({
    queryKey: ["live-penalidades"],
    queryFn: () => apiGet("/live/penalidades"),
    staleTime: 30_000,
  })

  const clientes = data?.data ?? []
  const filtrados = busca.trim()
    ? clientes.filter(c =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (c.instagram ?? "").toLowerCase().includes(busca.toLowerCase()) ||
        (c.celular ?? "").includes(busca)
      )
    : clientes

  const contadores = {
    advertida: clientes.filter(c => c.grau === "advertida").length,
    restrita:  clientes.filter(c => c.grau === "restrita").length,
    bloqueada: clientes.filter(c => c.grau === "bloqueada").length,
  }

  function toggleSelecao(id: number) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function sairModoSelecao() {
    setModoSelecao(false)
    setSelecionados(new Set())
  }

  const selecionadosLista = filtrados.filter(c => selecionados.has(c.id))

  return (
    <div className="min-h-full" style={{ background: "var(--bg-base)" }}>

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-10 px-4 sm:px-8 py-4 flex items-center justify-between gap-2"
        style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3 min-w-0">
          {modoSelecao ? (
            <button onClick={sairModoSelecao} className="p-2 rounded-xl" style={{ color: "var(--text-muted)" }}>
              <X size={18} />
            </button>
          ) : (
            <Link href="/live"
              className="p-2 rounded-xl transition-all"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-hover)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent" }}>
              <ArrowLeft size={18} />
            </Link>
          )}
          <div className="relative">
            {contadores.bloqueada > 0 && !modoSelecao && (
              <motion.span
                animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="absolute inset-0 rounded-xl"
                style={{ background: "#ef4444" }}
              />
            )}
            <div className="relative w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <ShieldAlert size={18} style={{ color: "#ef4444" }} />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-base uppercase tracking-widest truncate" style={{ color: "var(--text-primary)" }}>
              {modoSelecao ? `${selecionados.size} selecionada${selecionados.size !== 1 ? "s" : ""}` : "Penalidades"}
            </h1>
            {!modoSelecao && (
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                {isLoading ? "…" : `${clientes.length} cliente${clientes.length !== 1 ? "s" : ""} penalizada${clientes.length !== 1 ? "s" : ""}`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!modoSelecao && (
            <>
              <button
                onClick={() => imprimirListaPenalidades(filtrados)}
                disabled={filtrados.length === 0}
                title="Imprimir lista"
                className="p-2.5 rounded-xl transition-all disabled:opacity-40"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <Printer size={15} />
              </button>
              <motion.button
                onClick={() => setModoSelecao(true)}
                disabled={filtrados.length === 0}
                whileHover={{ scale: filtrados.length > 0 ? 1.04 : 1 }}
                whileTap={{ scale: filtrados.length > 0 ? 0.96 : 1 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }}>
                <MessageCircle size={15} /> <span className="hidden sm:inline">Enviar aviso</span>
              </motion.button>
            </>
          )}
        </div>
      </motion.div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-5 pb-28">

        {/* ── Cards de grau ── */}
        {!isLoading && clientes.length > 0 && !modoSelecao && (
          <div className="flex gap-3">
            <StatCard grau="advertida" count={contadores.advertida} delay={0.05} />
            <StatCard grau="restrita"  count={contadores.restrita}  delay={0.12} />
            <StatCard grau="bloqueada" count={contadores.bloqueada} delay={0.19} />
          </div>
        )}

        {/* ── Busca ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, @Instagram ou WhatsApp..."
            className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onFocus={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.1)" }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
          />
        </motion.div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <ShieldAlert size={28} style={{ color: "#ef4444" }} />
            </motion.div>
            <p className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Carregando…</p>
          </div>
        )}

        {/* ── Vazio ── */}
        {!isLoading && filtrados.length === 0 && (
          <EmptyIllustration busca={!!busca.trim()} />
        )}

        {/* ── Lista ── */}
        <AnimatePresence mode="popLayout">
          {filtrados.map((c, i) => {
            const cfg = GRAU_CONFIG[c.grau as keyof typeof GRAU_CONFIG] ?? GRAU_CONFIG.advertida
            const motivoLabel = c.ultimo_motivo ? (MOTIVO_LABEL[c.ultimo_motivo] ?? c.ultimo_motivo) : null
            const corBorder = c.grau === "bloqueada" ? "rgba(239,68,68,0.35)" : c.grau === "restrita" ? "rgba(249,115,22,0.25)" : "rgba(245,158,11,0.2)"
            const corGlow   = c.grau === "bloqueada" ? "rgba(239,68,68,0.06)" : "transparent"
            const marcado = selecionados.has(c.id)

            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, x: -20, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 340, damping: 28 }}
                onClick={() => modoSelecao && toggleSelecao(c.id)}
                className="flex items-center gap-4 px-4 py-4 rounded-2xl"
                style={{
                  background: `var(--bg-card)`,
                  border: `1.5px solid ${modoSelecao && marcado ? "#10b981" : corBorder}`,
                  boxShadow: c.grau === "bloqueada" ? `0 0 24px ${corGlow}` : undefined,
                  cursor: modoSelecao ? "pointer" : "default",
                }}>

                {modoSelecao && (
                  marcado
                    ? <CheckSquare size={18} style={{ color: "#10b981" }} className="shrink-0" />
                    : <Square size={18} style={{ color: "var(--text-muted)" }} className="shrink-0" />
                )}

                {/* Avatar */}
                <div className="relative shrink-0">
                  {c.grau === "bloqueada" && (
                    <motion.span
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-full"
                      style={{ background: "#ef4444" }}
                    />
                  )}
                  <div className={cn("relative w-11 h-11 rounded-full flex items-center justify-center text-base font-black", cfg.bg, cfg.cor)}>
                    {c.nome[0]}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>{c.nome}</p>
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ delay: i * 0.04 + 0.15, type: "spring" }}
                      className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1", cfg.bg, cfg.cor, cfg.border)}>
                      <GrauIcon grau={c.grau} size={9} />
                      {cfg.label} · {c.total_penalidades_ativas}
                    </motion.span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {c.instagram && <span className="text-xs" style={{ color: "var(--accent)" }}>@{c.instagram.replace(/^@/, "")}</span>}
                    {c.celular && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{c.celular}</span>}
                    {motivoLabel && <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {motivoLabel}</span>}
                    {c.penalidade_aviso_em && (
                      <span className="text-[10px] inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                        <Clock size={10} /> avisada {tempoDesde(c.penalidade_aviso_em)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações rápidas (fora do modo seleção) */}
                {!modoSelecao && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setModalEnvio([c]) }}
                      title="Enviar aviso via WhatsApp"
                      className="p-2 rounded-xl transition-all"
                      style={{ background: "rgba(16,185,129,0.10)", color: "#10b981" }}>
                      <MessageCircle size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setModalRemocao([c]) }}
                      title="Remover penalidade"
                      className="p-2 rounded-xl transition-all"
                      style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>
                      <Trash2 size={14} />
                    </button>
                    <Link href={`/clientes?id=${c.id}&tab=penalidades`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] font-bold uppercase px-3 py-2 rounded-xl transition-all"
                      style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      Ver
                    </Link>
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* ── Barra de ações em massa ── */}
      <AnimatePresence>
        {modoSelecao && selecionados.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-8 py-3 flex items-center justify-center gap-2"
            style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>
            <div className="max-w-3xl w-full flex gap-2">
              <button onClick={() => setModalEnvio(selecionadosLista)}
                className="flex-1 py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                <MessageCircle size={15} /> Enviar aviso ({selecionados.size})
              </button>
              <button onClick={() => setModalRemocao(selecionadosLista)}
                className="px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                <Trash2 size={15} /> Remover
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modais ── */}
      <AnimatePresence>
        {modalEnvio && (
          <ModalEnviarAviso
            clientes={modalEnvio}
            onClose={() => setModalEnvio(null)}
            onEnviar={(itens) => {
              iniciarPenalidade(itens)
              setModalEnvio(null)
              sairModoSelecao()
            }}
          />
        )}
        {modalRemocao && (
          <ModalRemoverPenalidade
            clientes={modalRemocao}
            onClose={() => setModalRemocao(null)}
            onRemovido={() => {
              qc.invalidateQueries({ queryKey: ["live-penalidades"] })
              setModalRemocao(null)
              sairModoSelecao()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
