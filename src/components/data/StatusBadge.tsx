"use client"

import { cn } from "@/lib/utils"

interface ColorEntry {
  bg: string
  text: string
  dot?: string
}

interface StatusBadgeProps {
  status: string
  colorMap?: Record<string, ColorEntry>
  className?: string
}

const DEFAULT_COLOR_MAP: Record<string, ColorEntry> = {
  // pending / pendente
  pending:  { bg: "bg-amber-500/10",   text: "text-amber-400",   dot: "bg-amber-400" },
  pendente: { bg: "bg-amber-500/10",   text: "text-amber-400",   dot: "bg-amber-400" },
  // approved / aprovado / ativo / active
  aprovado: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  ativo:    { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  active:   { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  // recusado / inativo / inactive / canceled / cancelado
  recusado:  { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  inativo:   { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  inactive:  { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  canceled:  { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  cancelado: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  // concluido / completed / delivered
  concluido: { bg: "bg-blue-500/10",   text: "text-blue-400",   dot: "bg-blue-400" },
  completed: { bg: "bg-blue-500/10",   text: "text-blue-400",   dot: "bg-blue-400" },
  delivered: { bg: "bg-blue-500/10",   text: "text-blue-400",   dot: "bg-blue-400" },
  // enviado / posted / in transit
  enviado:    { bg: "bg-sky-500/10",  text: "text-sky-400",  dot: "bg-sky-400" },
  posted:     { bg: "bg-sky-500/10",  text: "text-sky-400",  dot: "bg-sky-400" },
  "in transit": { bg: "bg-sky-500/10", text: "text-sky-400", dot: "bg-sky-400" },
  // erro / error
  erro:  { bg: "bg-rose-500/10", text: "text-rose-400", dot: "bg-rose-400" },
  error: { bg: "bg-rose-500/10", text: "text-rose-400", dot: "bg-rose-400" },
  // generated / released
  generated: { bg: "bg-violet-500/10", text: "text-violet-400", dot: "bg-violet-400" },
  released:  { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400" },
  // pago / recebido
  pago:     { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  recebido: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  // vencido
  vencido: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
}

export function StatusBadge({ status, colorMap, className }: StatusBadgeProps) {
  const map = colorMap ?? DEFAULT_COLOR_MAP
  const key = status?.toLowerCase() ?? ""
  const colors: ColorEntry = map[key] ?? { bg: "bg-slate-500/10", text: "text-slate-400", dot: "bg-slate-400" }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full",
        colors.bg,
        colors.text,
        className,
      )}
    >
      {colors.dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", colors.dot)} />
      )}
      {status}
    </span>
  )
}
