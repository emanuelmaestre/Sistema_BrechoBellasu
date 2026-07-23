"use client"

import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Loader2, TrendingUp, Tag, Users, Target, CreditCard,
  Trophy, DollarSign, ArrowDownCircle, ArrowUpCircle,
  Calendar, HelpCircle, FileSpreadsheet, FileText,
  ChevronDown, ChevronUp,
} from "lucide-react"
import { apiGet } from "@/services/api"
import { DatePickerCompact } from "@/components/DatePicker"
import { fmtBRL, fmtData } from "@/lib/utils"
import { exportExcelProfissional, exportPdfProfissional } from "@/lib/export-helpers"

// ─── Tipos ────────────────────────────────────────────────
type VendasPeriodo   = { dia: string; qtd: number; total: number }
type MaisVendido     = { nome_produto: string; total_quantidade: number; total_valor: number }
type TicketMedio     = { ticket_medio: number; total_vendas: number; total_valor: number }
type FormaPagamento  = { forma_pagamento: string; qtd: number; total: number }
type VendasCliente   = { nome: string; total_compras: number; total_gasto: number }
type FluxoCaixa      = { entradas: number; saidas: number; saldo: number }
type TrocaMotivo     = { motivo: string; qtd: number }

type ReportKey =
  | "vendas-periodo" | "vendas-produto" | "vendas-cliente"
  | "ticket" | "formas-pagamento" | "mais-vendidos"
  | "fluxo-caixa" | "contas-pagar" | "contas-receber"
  | "trocas-periodo" | "trocas-motivo"

// ─── Período ──────────────────────────────────────────────
const PERIODOS = [
  { key: "hoje",   label: "Hoje" },
  { key: "semana", label: "7 dias" },
  { key: "mes",    label: "30 dias" },
  { key: "ano",    label: "Este ano" },
  { key: "custom", label: "Personalizado" },
]

function getPeriodo(key: string, de: string, ate: string) {
  const fmt = (d: Date) => d.toISOString().split("T")[0]
  const hoje = new Date()
  if (key === "hoje")   return { de: fmt(hoje), ate: fmt(hoje) }
  if (key === "semana") { const d = new Date(hoje); d.setDate(d.getDate() - 6); return { de: fmt(d), ate: fmt(hoje) } }
  if (key === "mes")    { const d = new Date(hoje); d.setDate(d.getDate() - 29); return { de: fmt(d), ate: fmt(hoje) } }
  if (key === "ano")    { return { de: `${hoje.getFullYear()}-01-01`, ate: fmt(hoje) } }
  return { de, ate }
}

// helpers locais reutilizando getPeriodo
function periodoLabel(qs: string): string {
  try {
    const p = Object.fromEntries(new URLSearchParams(qs))
    const fmt = (s: string) => { const [y,m,d] = s.split("-"); return `${d}/${m}/${y}` }
    if (p.de && p.ate && p.de !== p.ate) return `${fmt(p.de)} a ${fmt(p.ate)}`
    if (p.de) return fmt(p.de)
    return "—"
  } catch { return "—" }
}

// ─── Componentes base ─────────────────────────────────────
function PeriodoBar({ periodo, setPeriodo, de, setDe, ate, setAte }: {
  periodo: string; setPeriodo: (v: string) => void
  de: string; setDe: (v: string) => void; ate: string; setAte: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-2xl"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <span className="text-[10px] font-bold uppercase tracking-wider mr-1" style={{ color: "var(--text-muted)" }}>Período:</span>
      {PERIODOS.map(p => (
        <button key={p.key} onClick={() => setPeriodo(p.key)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all"
          style={{
            background: periodo === p.key ? "var(--accent)" : "transparent",
            color: periodo === p.key ? "#fff" : "var(--text-secondary)",
          }}>
          {p.label}
        </button>
      ))}
      {periodo === "custom" && (
        <>
          <DatePickerCompact value={de} onChange={v => setDe(v)} placeholder="De" />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>até</span>
          <DatePickerCompact value={ate} onChange={v => setAte(v)} placeholder="Até" />
        </>
      )}
    </div>
  )
}

function ExportBar({ onPDF, onXLSX, loading }: { onPDF: () => void; onXLSX: () => void; loading?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onXLSX} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
        style={{ background: "var(--bg-surface)", borderColor: "#16a34a", color: "#16a34a" }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f0fdf4" }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)" }}>
        <FileSpreadsheet size={13}/> Excel
      </button>
      <button onClick={onPDF} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
        style={{ background: "var(--bg-surface)", borderColor: "#dc2626", color: "#dc2626" }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2" }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)" }}>
        <FileText size={13}/> PDF
      </button>
    </div>
  )
}

function ReportCard({ icon: Icon, title, desc, active, onClick, color }: {
  icon: React.ElementType; title: string; desc: string
  active: boolean; onClick: () => void; color?: string
}) {
  const c = color ?? "var(--accent)"
  return (
    <button onClick={onClick}
      className="text-left p-4 rounded-2xl transition-all border w-full"
      style={{
        background: active ? "var(--accent-bg)" : "var(--bg-card)",
        borderColor: active ? c : "var(--border)",
        boxShadow: active ? `0 0 0 2px ${c}22` : undefined,
      }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ background: active ? c : "var(--bg-surface)" }}>
        <Icon size={17} style={{ color: active ? "#fff" : "var(--text-muted)" }} />
      </div>
      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{title}</p>
      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</p>
      <div className="flex items-center gap-1 mt-2 text-xs font-medium" style={{ color: c }}>
        {active ? <><ChevronUp size={12}/> Fechar</> : <><ChevronDown size={12}/> Ver dados</>}
      </div>
    </button>
  )
}

function Section({ title, desc, cols, children }: { title: string; desc: string; cols?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{title}</h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</p>
      </div>
      <div className={`p-4 grid gap-3 ${cols === 2 ? "grid-cols-2" : cols === 5 ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-3"}`}>
        {children}
      </div>
    </div>
  )
}

function DataPanel({ title, loading, children, exportBar }: {
  title: string; loading?: boolean; children: React.ReactNode; exportBar?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "2px solid var(--accent)", background: "var(--bg-card)" }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)", background: "var(--accent-bg)" }}>
        <p className="font-bold text-sm" style={{ color: "var(--accent)" }}>{title}</p>
        {exportBar}
      </div>
      <div className="p-5">
        {loading
          ? <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }}/></div>
          : children}
      </div>
    </div>
  )
}

const SemDados = () => (
  <p className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>Sem dados para o período selecionado</p>
)

// ─── RELATÓRIOS INDIVIDUAIS ───────────────────────────────

function RelVendasPeriodo({ qs }: { qs: string }) {
  const { data, isLoading } = useQuery<VendasPeriodo[]>({
    queryKey: ["rel-vendas-periodo", qs], staleTime: 60_000,
    queryFn: () => apiGet(`/relatorios?tipo=vendas-periodo&${qs}`),
  })

  const total = data?.reduce((s, d) => s + d.total, 0) ?? 0
  const qtd   = data?.reduce((s, d) => s + d.qtd,   0) ?? 0

  const doExport = (fmt: "xlsx" | "pdf") => {
    const headers = ["Data", "Qtd. Vendas", "Total (R$)"]
    const rows = (data ?? []).map(d => [fmtData(d.dia), d.qtd, fmtBRL(d.total)])
    const totais = ["TOTAL", qtd, fmtBRL(total)]
    const periodoStr = periodoLabel(qs)
    const resumo = [
      { label: "Total em R$", valor: fmtBRL(total), destaque: true },
      { label: "Qtd. de Vendas", valor: String(qtd) },
    ]
    if (fmt === "xlsx") exportExcelProfissional({ relatorio: "Vendas por Período", headers, rows, totais, periodoStr })
    else exportPdfProfissional({ relatorio: "Vendas por Período", headers, rows, totais, periodoStr, resumo, colAligns: ["left","center","right"] })
  }

  return (
    <DataPanel title="Vendas por Período" loading={isLoading}
      exportBar={<ExportBar onXLSX={() => doExport("xlsx")} onPDF={() => doExport("pdf")} loading={isLoading}/>}>
      {!data?.length ? <SemDados /> : <>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[["Total em R$", fmtBRL(total), "var(--accent)"], ["Qtd. de Vendas", String(qtd), "var(--text-primary)"]].map(([l, v, c]) => (
            <div key={l} className="rounded-xl p-4 text-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{l}</p>
              <p className="text-xl font-bold" style={{ color: c }}>{v}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          <div className="grid grid-cols-3 text-[10px] font-bold uppercase tracking-wider pb-2 px-2" style={{ color: "var(--text-muted)" }}>
            <span>Data</span><span className="text-center">Vendas</span><span className="text-right">Total</span>
          </div>
          {data.map(d => (
            <div key={d.dia} className="grid grid-cols-3 items-center px-2 py-2 rounded-lg transition-colors"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{fmtData(d.dia)}</span>
              <span className="text-sm text-center" style={{ color: "var(--text-muted)" }}>{d.qtd}x</span>
              <span className="text-sm font-semibold text-right" style={{ color: "var(--text-primary)" }}>{fmtBRL(d.total)}</span>
            </div>
          ))}
        </div>
      </>}
    </DataPanel>
  )
}

function RelVendasProduto({ qs }: { qs: string }) {
  const { data, isLoading } = useQuery<MaisVendido[]>({
    queryKey: ["rel-mais-vendidos-prod", qs], staleTime: 60_000,
    queryFn: () => apiGet(`/relatorios?tipo=produtos-mais-vendidos&${qs}`),
  })

  const doExport = (fmt: "xlsx" | "pdf") => {
    const headers = ["#", "Produto", "Qtd. Vendida", "Total (R$)"]
    const rows = (data ?? []).map((p, i) => [i + 1, p.nome_produto, p.total_quantidade, fmtBRL(p.total_valor)])
    const totalQtd = data?.reduce((s, p) => s + p.total_quantidade, 0) ?? 0
    const totalVal = data?.reduce((s, p) => s + p.total_valor, 0) ?? 0
    const totais = ["", "TOTAL", totalQtd, fmtBRL(totalVal)]
    const periodoStr = periodoLabel(qs)
    if (fmt === "xlsx") exportExcelProfissional({ relatorio: "Vendas por Produto", headers, rows, totais, periodoStr })
    else exportPdfProfissional({ relatorio: "Vendas por Produto", headers, rows, totais, periodoStr, colAligns: ["center","left","center","right"] })
  }

  return (
    <DataPanel title="Vendas por Produto" loading={isLoading}
      exportBar={<ExportBar onXLSX={() => doExport("xlsx")} onPDF={() => doExport("pdf")} loading={isLoading}/>}>
      {!data?.length ? <SemDados /> : (
        <div className="space-y-1 max-h-80 overflow-y-auto overflow-x-auto">
          <div className="grid grid-cols-12 text-[10px] font-bold uppercase tracking-wider pb-2 px-2 min-w-[320px]" style={{ color: "var(--text-muted)" }}>
            <span className="col-span-1">#</span><span className="col-span-7">Produto</span>
            <span className="col-span-2 text-center">Qtd</span><span className="col-span-2 text-right">Total</span>
          </div>
          {data.map((p, i) => (
            <div key={p.nome_produto} className="grid grid-cols-12 items-center px-2 py-2.5 rounded-lg min-w-[320px]"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="col-span-1 text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold"
                style={{ background: i < 3 ? "var(--accent)" : "var(--bg-surface)", color: i < 3 ? "#fff" : "var(--text-muted)" }}>
                {i + 1}
              </span>
              <span className="col-span-7 text-sm truncate pr-2" style={{ color: "var(--text-secondary)" }}>{p.nome_produto}</span>
              <span className="col-span-2 text-sm text-center" style={{ color: "var(--text-muted)" }}>{p.total_quantidade}x</span>
              <span className="col-span-2 text-sm font-semibold text-right" style={{ color: "var(--text-primary)" }}>{fmtBRL(p.total_valor)}</span>
            </div>
          ))}
        </div>
      )}
    </DataPanel>
  )
}

function RelVendasCliente({ qs }: { qs: string }) {
  const { data, isLoading } = useQuery<VendasCliente[]>({
    queryKey: ["rel-clientes", qs], staleTime: 60_000,
    queryFn: () => apiGet(`/relatorios/vendas-cliente?${qs}`),
  })

  const doExport = (fmt: "xlsx" | "pdf") => {
    const headers = ["#", "Cliente", "Compras", "Total Gasto (R$)"]
    const rows = (data ?? []).map((c, i) => [i + 1, c.nome.toUpperCase(), c.total_compras, fmtBRL(c.total_gasto)])
    const totalCompras = data?.reduce((s, c) => s + c.total_compras, 0) ?? 0
    const totalGasto   = data?.reduce((s, c) => s + c.total_gasto,   0) ?? 0
    const totais = ["", "TOTAL", totalCompras, fmtBRL(totalGasto)]
    const periodoStr = periodoLabel(qs)
    const resumo = [
      { label: "Clientes Ativos", valor: String(data?.length ?? 0) },
      { label: "Total de Compras", valor: String(totalCompras) },
      { label: "Total Faturado", valor: fmtBRL(totalGasto), destaque: true },
    ]
    if (fmt === "xlsx") exportExcelProfissional({ relatorio: "Vendas por Cliente", headers, rows, totais, periodoStr })
    else exportPdfProfissional({ relatorio: "Vendas por Cliente", headers, rows, totais, periodoStr, resumo, colAligns: ["center","left","center","right"] })
  }

  return (
    <DataPanel title="Vendas por Cliente" loading={isLoading}
      exportBar={<ExportBar onXLSX={() => doExport("xlsx")} onPDF={() => doExport("pdf")} loading={isLoading}/>}>
      {!data?.length ? <SemDados /> : (
        <div className="space-y-1 max-h-80 overflow-y-auto overflow-x-auto">
          <div className="grid grid-cols-12 text-[10px] font-bold uppercase tracking-wider pb-2 px-2 min-w-[320px]" style={{ color: "var(--text-muted)" }}>
            <span className="col-span-1">#</span><span className="col-span-7">Cliente</span>
            <span className="col-span-2 text-center">Compras</span><span className="col-span-2 text-right">Total</span>
          </div>
          {data.map((c, i) => (
            <div key={c.nome} className="grid grid-cols-12 items-center px-2 py-2.5 rounded-lg min-w-[320px]"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="col-span-1 text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold"
                style={{ background: i < 3 ? "var(--accent)" : "var(--bg-surface)", color: i < 3 ? "#fff" : "var(--text-muted)" }}>
                {i + 1}
              </span>
              <span className="col-span-7 text-sm truncate pr-2 uppercase" style={{ color: "var(--text-secondary)" }}>{c.nome}</span>
              <span className="col-span-2 text-sm text-center" style={{ color: "var(--text-muted)" }}>{c.total_compras}x</span>
              <span className="col-span-2 text-sm font-semibold text-right" style={{ color: "var(--text-primary)" }}>{fmtBRL(c.total_gasto)}</span>
            </div>
          ))}
        </div>
      )}
    </DataPanel>
  )
}

function RelTicket({ qs }: { qs: string }) {
  const { data, isLoading } = useQuery<TicketMedio>({
    queryKey: ["rel-ticket", qs], staleTime: 60_000,
    queryFn: () => apiGet(`/relatorios?tipo=ticket-medio&${qs}`),
  })

  const doExport = (fmt: "xlsx" | "pdf") => {
    const headers = ["Indicador", "Valor"]
    const rows = data
      ? [["Ticket Médio", fmtBRL(data.ticket_medio)], ["Total de Vendas", String(data.total_vendas)], ["Total Faturado", fmtBRL(data.total_valor)]]
      : []
    const periodoStr = periodoLabel(qs)
    const resumo = data ? [
      { label: "Ticket Médio", valor: fmtBRL(data.ticket_medio), destaque: true },
      { label: "Total de Vendas", valor: String(data.total_vendas) },
      { label: "Total Faturado", valor: fmtBRL(data.total_valor) },
    ] : []
    if (fmt === "xlsx") exportExcelProfissional({ relatorio: "Ticket Médio", headers, rows, periodoStr })
    else exportPdfProfissional({ relatorio: "Ticket Médio", headers, rows, periodoStr, resumo, orientation: "portrait" })
  }

  return (
    <DataPanel title="Ticket Médio" loading={isLoading}
      exportBar={<ExportBar onXLSX={() => doExport("xlsx")} onPDF={() => doExport("pdf")} loading={isLoading}/>}>
      {!data || !data.total_vendas ? <SemDados /> : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            ["Ticket Médio",   fmtBRL(data.ticket_medio), "var(--accent)"],
            ["Total de Vendas", String(data.total_vendas), "var(--text-primary)"],
            ["Total em R$",    fmtBRL(data.total_valor),  "var(--text-primary)"],
          ].map(([l, v, c]) => (
            <div key={l} className="rounded-2xl p-5 text-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{l}</p>
              <p className="text-2xl font-bold" style={{ color: c }}>{v}</p>
            </div>
          ))}
        </div>
      )}
    </DataPanel>
  )
}

function RelFormasPagamento({ qs }: { qs: string }) {
  const { data, isLoading } = useQuery<FormaPagamento[]>({
    queryKey: ["rel-formas", qs], staleTime: 60_000,
    queryFn: () => apiGet(`/relatorios?tipo=formas-pagamento&${qs}`),
  })

  const doExport = (fmt: "xlsx" | "pdf") => {
    const headers = ["Forma de Pagamento", "Qtd.", "Total (R$)", "Participação (%)"]
    const totalGeral = data?.reduce((s, f) => s + f.total, 0) ?? 0
    const rows = (data ?? []).map(f => [
      f.forma_pagamento, f.qtd, fmtBRL(f.total),
      totalGeral > 0 ? `${((f.total / totalGeral) * 100).toFixed(1)}%` : "0,0%",
    ])
    const totalQtd = data?.reduce((s, f) => s + f.qtd, 0) ?? 0
    const totais = ["TOTAL", totalQtd, fmtBRL(totalGeral), "100%"]
    const periodoStr = periodoLabel(qs)
    if (fmt === "xlsx") exportExcelProfissional({ relatorio: "Formas de Pagamento", headers, rows, totais, periodoStr })
    else exportPdfProfissional({ relatorio: "Formas de Pagamento", headers, rows, totais, periodoStr, colAligns: ["left","center","right","center"], orientation: "portrait" })
  }

  const maxVal = Math.max(...(data?.map(f => f.total) ?? [1]))

  return (
    <DataPanel title="Formas de Pagamento" loading={isLoading}
      exportBar={<ExportBar onXLSX={() => doExport("xlsx")} onPDF={() => doExport("pdf")} loading={isLoading}/>}>
      {!data?.length ? <SemDados /> : (
        <div className="space-y-4">
          {data.map(f => {
            const pct = Math.round((f.total / maxVal) * 100)
            return (
              <div key={f.forma_pagamento}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{f.forma_pagamento}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{f.qtd}x</span>
                    <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{fmtBRL(f.total)}</span>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
                      style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>{pct}%</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--accent)" }}/>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </DataPanel>
  )
}

function RelMaisVendidos({ qs }: { qs: string }) {
  const { data, isLoading } = useQuery<MaisVendido[]>({
    queryKey: ["rel-mais-vendidos", qs], staleTime: 60_000,
    queryFn: () => apiGet(`/relatorios?tipo=produtos-mais-vendidos&${qs}`),
  })

  const doExport = (fmt: "xlsx" | "pdf") => {
    const headers = ["#", "Produto", "Qtd. Vendida", "Total (R$)"]
    const rows = (data ?? []).map((p, i) => [i + 1, p.nome_produto, p.total_quantidade, fmtBRL(p.total_valor)])
    const totalQtd = data?.reduce((s, p) => s + p.total_quantidade, 0) ?? 0
    const totalVal = data?.reduce((s, p) => s + p.total_valor, 0) ?? 0
    const totais = ["", "TOTAL", totalQtd, fmtBRL(totalVal)]
    const periodoStr = periodoLabel(qs)
    if (fmt === "xlsx") exportExcelProfissional({ relatorio: "Produtos Mais Vendidos", headers, rows, totais, periodoStr })
    else exportPdfProfissional({ relatorio: "Produtos Mais Vendidos", headers, rows, totais, periodoStr, colAligns: ["center","left","center","right"] })
  }

  return (
    <DataPanel title="Produtos Mais Vendidos" loading={isLoading}
      exportBar={<ExportBar onXLSX={() => doExport("xlsx")} onPDF={() => doExport("pdf")} loading={isLoading}/>}>
      {!data?.length ? <SemDados /> : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {data.slice(0, 20).map((p, i) => (
            <div key={p.nome_produto} className="flex items-center gap-3 px-2 py-2.5 rounded-lg"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-xs w-7 h-7 rounded-full flex items-center justify-center font-bold shrink-0"
                style={{ background: i < 3 ? "var(--accent)" : "var(--bg-surface)", color: i < 3 ? "#fff" : "var(--text-muted)" }}>
                {i + 1}
              </span>
              <span className="text-sm flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{p.nome_produto}</span>
              <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{p.total_quantidade}x</span>
              <span className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{fmtBRL(p.total_valor)}</span>
            </div>
          ))}
        </div>
      )}
    </DataPanel>
  )
}

function RelFluxoCaixa({ qs, title }: { qs: string; title: string }) {
  const { data, isLoading } = useQuery<FluxoCaixa>({
    queryKey: ["rel-fluxo", qs], staleTime: 60_000,
    queryFn: () => apiGet(`/relatorios?tipo=fluxo-caixa&${qs}`),
  })

  const doExport = (fmt: "xlsx" | "pdf") => {
    const headers = ["Indicador", "Valor (R$)"]
    const rows = data
      ? [["Entradas", fmtBRL(data.entradas)], ["Saídas", fmtBRL(data.saidas)], ["Saldo Líquido", fmtBRL(data.saldo)]]
      : []
    const periodoStr = periodoLabel(qs)
    const resumo = data ? [
      { label: "Entradas", valor: fmtBRL(data.entradas), destaque: false },
      { label: "Saídas",   valor: fmtBRL(data.saidas),   destaque: false },
      { label: "Saldo",    valor: fmtBRL(data.saldo),     destaque: true  },
    ] : []
    if (fmt === "xlsx") exportExcelProfissional({ relatorio: title, headers, rows, periodoStr })
    else exportPdfProfissional({ relatorio: title, headers, rows, periodoStr, resumo, orientation: "portrait" })
  }

  return (
    <DataPanel title={title} loading={isLoading}
      exportBar={<ExportBar onXLSX={() => doExport("xlsx")} onPDF={() => doExport("pdf")} loading={isLoading}/>}>
      {!data ? <SemDados /> : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            ["Entradas", fmtBRL(data.entradas), "#16a34a", "#f0fdf4", "#bbf7d0"],
            ["Saídas",   fmtBRL(data.saidas),   "#dc2626", "#fef2f2", "#fecaca"],
            ["Saldo",    fmtBRL(data.saldo),     data.saldo >= 0 ? "#16a34a" : "#dc2626",
              data.saldo >= 0 ? "#f0fdf4" : "#fef2f2",
              data.saldo >= 0 ? "#bbf7d0" : "#fecaca"],
          ].map(([l, v, c, bg, border]) => (
            <div key={l} className="rounded-2xl p-5 text-center"
              style={{ background: bg, border: `1px solid ${border}` }}>
              <p className="text-xs mb-2 font-semibold" style={{ color: c }}>{l}</p>
              <p className="text-2xl font-bold" style={{ color: c }}>{v}</p>
            </div>
          ))}
        </div>
      )}
    </DataPanel>
  )
}

function RelTrocas({ qs, title }: { qs: string; title: string }) {
  const { data, isLoading } = useQuery<TrocaMotivo[]>({
    queryKey: ["rel-trocas", qs], staleTime: 60_000,
    queryFn: () => apiGet(`/relatorios?tipo=trocas-motivos&${qs}`),
  })

  const doExport = (fmt: "xlsx" | "pdf") => {
    const headers = ["Motivo", "Qtd.", "Participação (%)"]
    const totalQtd = data?.reduce((s, m) => s + m.qtd, 0) ?? 0
    const rows = (data ?? []).map(m => [
      m.motivo, m.qtd,
      totalQtd > 0 ? `${((m.qtd / totalQtd) * 100).toFixed(1)}%` : "0,0%",
    ])
    const totais = ["TOTAL", totalQtd, "100%"]
    const periodoStr = periodoLabel(qs)
    const resumo = [{ label: "Total de Trocas/Dev.", valor: String(totalQtd), destaque: true }]
    if (fmt === "xlsx") exportExcelProfissional({ relatorio: title, headers, rows, totais, periodoStr })
    else exportPdfProfissional({ relatorio: title, headers, rows, totais, periodoStr, resumo, orientation: "portrait", colAligns: ["left","center","center"] })
  }

  return (
    <DataPanel title={title} loading={isLoading}
      exportBar={<ExportBar onXLSX={() => doExport("xlsx")} onPDF={() => doExport("pdf")} loading={isLoading}/>}>
      {!data?.length ? <SemDados /> : (
        <div className="space-y-2">
          {data.map(m => (
            <div key={m.motivo} className="flex items-center justify-between py-2.5 px-2"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{m.motivo}</span>
              <span className="text-sm font-bold px-3 py-1 rounded-full"
                style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>{m.qtd}x</span>
            </div>
          ))}
        </div>
      )}
    </DataPanel>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────
export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState("mes")
  const [de, setDe] = useState("")
  const [ate, setAte] = useState("")
  const [active, setActive] = useState<ReportKey | null>(null)

  const params = getPeriodo(periodo, de, ate)
  const qs = new URLSearchParams(params as Record<string, string>).toString()

  const toggle = useCallback((id: ReportKey) => setActive(v => v === id ? null : id), [])

  return (
    <div className="space-y-4 pt-3 sm:pt-6">
      <div>
        <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>Relatórios</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Clique em um relatório para ver os dados, exportar em PDF ou Excel</p>
      </div>

      <PeriodoBar periodo={periodo} setPeriodo={setPeriodo} de={de} setDe={setDe} ate={ate} setAte={setAte} />

      {/* ── VENDAS ── */}
      <Section title="Vendas" desc="Análises de desempenho comercial" cols={5}>
        <ReportCard icon={TrendingUp} title="Vendas por período"  desc="Total por dia/semana/mês"        active={active==="vendas-periodo"}   onClick={() => toggle("vendas-periodo")} />
        <ReportCard icon={Tag}        title="Vendas por produto"  desc="Quais produtos mais geraram receita" active={active==="vendas-produto"}   onClick={() => toggle("vendas-produto")} />
        <ReportCard icon={Users}      title="Vendas por cliente"  desc="Clientes com mais compras"       active={active==="vendas-cliente"}   onClick={() => toggle("vendas-cliente")} />
        <ReportCard icon={Target}     title="Ticket médio"        desc="Valor médio por venda"           active={active==="ticket"}           onClick={() => toggle("ticket")} />
        <ReportCard icon={CreditCard} title="Formas de pagamento" desc="Distribuição por método"         active={active==="formas-pagamento"} onClick={() => toggle("formas-pagamento")} />
      </Section>

      {active === "vendas-periodo"   && <RelVendasPeriodo   key="vendas-periodo"   qs={qs} />}
      {active === "vendas-produto"   && <RelVendasProduto   key="vendas-produto"   qs={qs} />}
      {active === "vendas-cliente"   && <RelVendasCliente   key="vendas-cliente"   qs={qs} />}
      {active === "ticket"           && <RelTicket          key="ticket"           qs={qs} />}
      {active === "formas-pagamento" && <RelFormasPagamento key="formas-pagamento" qs={qs} />}

      {/* ── PRODUTOS ── */}
      <Section title="Produtos" desc="Análises de estoque e giro" cols={2}>
        <ReportCard icon={Trophy} title="Mais vendidos" desc="Ranking dos produtos com maior saída" active={active==="mais-vendidos"} onClick={() => toggle("mais-vendidos")} />
      </Section>

      {active === "mais-vendidos" && <RelMaisVendidos qs={qs} />}

      {/* ── FINANCEIRO ── */}
      <Section title="Financeiro" desc="Saúde financeira do negócio">
        <ReportCard icon={ArrowDownCircle} title="Contas a pagar"   desc="Resumo de obrigações"       active={active==="contas-pagar"}   onClick={() => toggle("contas-pagar")} />
        <ReportCard icon={ArrowUpCircle}   title="Contas a receber" desc="Recebíveis e previstos"     active={active==="contas-receber"} onClick={() => toggle("contas-receber")} />
        <ReportCard icon={DollarSign}      title="Fluxo de caixa"   desc="Entradas e saídas"          active={active==="fluxo-caixa"}    onClick={() => toggle("fluxo-caixa")} />
      </Section>

      {active && ["contas-pagar","contas-receber","fluxo-caixa"].includes(active) && (
        <RelFluxoCaixa qs={qs}
          title={active === "contas-pagar" ? "Contas a Pagar" : active === "contas-receber" ? "Contas a Receber" : "Fluxo de Caixa"} />
      )}

      {/* ── TROCAS ── */}
      <Section title="Trocas e Devoluções" desc="Análise de pós-venda">
        <ReportCard icon={Calendar}   title="Total por período" desc="Volume de solicitações" active={active==="trocas-periodo"} onClick={() => toggle("trocas-periodo")} />
        <ReportCard icon={HelpCircle} title="Por motivo"        desc="Razões de devolução"   active={active==="trocas-motivo"}  onClick={() => toggle("trocas-motivo")} />
      </Section>

      {active && ["trocas-periodo","trocas-motivo"].includes(active) && (
        <RelTrocas qs={qs}
          title={active === "trocas-periodo" ? "Trocas por Período" : "Trocas por Motivo"} />
      )}
    </div>
  )
}
