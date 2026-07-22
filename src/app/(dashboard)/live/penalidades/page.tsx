"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "motion/react"
import { Loader2, ShieldAlert, Printer, ArrowLeft, Search, AlertTriangle, Ban, AlertCircle } from "lucide-react"
import Link from "next/link"
import { apiGet, apiPatch } from "@/services/api"
import { GRAU_CONFIG, MOTIVO_LABEL } from "@/domain/live/penalidade"
import { cn } from "@/lib/utils"

interface ClientePenalizado {
  id: number
  nome: string
  instagram?: string | null
  celular?: string | null
  apelido?: string | null
  total_penalidades_ativas: number
  grau: string
  ultimo_motivo?: string | null
}

function imprimirListaPenalidades(clientes: ClientePenalizado[]) {
  const data = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  const linhas = clientes.map((c, i) => {
    const motivoLabel = c.ultimo_motivo ? (MOTIVO_LABEL[c.ultimo_motivo as keyof typeof MOTIVO_LABEL] ?? c.ultimo_motivo) : "—"
    const corHex = c.grau === "bloqueada" ? "#dc2626" : c.grau === "restrita" ? "#ea580c" : "#d97706"
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

export default function PenalidadesPage() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState("")

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

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-10 px-4 sm:px-8 py-4 flex items-center justify-between"
        style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          <Link href="/live"
            className="p-2 rounded-xl transition-all"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-hover)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent" }}>
            <ArrowLeft size={18} />
          </Link>
          {/* Ícone com pulse se houver bloqueadas */}
          <div className="relative">
            {contadores.bloqueada > 0 && (
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
          <div>
            <h1 className="font-black text-base uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
              Penalidades
            </h1>
            <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              {isLoading ? "…" : `${clientes.length} cliente${clientes.length !== 1 ? "s" : ""} penalizada${clientes.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <motion.button
          onClick={() => imprimirListaPenalidades(filtrados)}
          disabled={filtrados.length === 0}
          whileHover={{ scale: filtrados.length > 0 ? 1.04 : 1 }}
          whileTap={{ scale: filtrados.length > 0 ? 0.96 : 1 }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
          style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
          <Printer size={15} /> <span className="hidden sm:inline">Imprimir lista</span>
        </motion.button>
      </motion.div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-5">

        {/* ── Cards de grau ── */}
        {!isLoading && clientes.length > 0 && (
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
            const motivoLabel = c.ultimo_motivo ? (MOTIVO_LABEL[c.ultimo_motivo as keyof typeof MOTIVO_LABEL] ?? c.ultimo_motivo) : null
            const corBorder = c.grau === "bloqueada" ? "rgba(239,68,68,0.35)" : c.grau === "restrita" ? "rgba(249,115,22,0.25)" : "rgba(245,158,11,0.2)"
            const corGlow   = c.grau === "bloqueada" ? "rgba(239,68,68,0.06)" : "transparent"

            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, x: -20, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 340, damping: 28 }}
                className="flex items-center gap-4 px-4 py-4 rounded-2xl"
                style={{
                  background: `var(--bg-card)`,
                  border: `1.5px solid ${corBorder}`,
                  boxShadow: c.grau === "bloqueada" ? `0 0 24px ${corGlow}` : undefined,
                }}>

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
                  </div>
                </div>

                {/* Botão Ver */}
                <Link href={`/clientes?id=${c.id}&tab=penalidades`}
                  className="shrink-0 text-[10px] font-bold uppercase px-3 py-2 rounded-xl transition-all"
                  style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-hover)" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-surface)" }}>
                  Ver
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
