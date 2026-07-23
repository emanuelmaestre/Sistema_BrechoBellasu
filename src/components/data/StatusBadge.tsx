"use client"

import { cn } from "@/lib/utils"
import statusData from "@/data/ui/status.json"

const DEFAULT_COLOR_MAP: Record<string, ColorEntry> = statusData.defaultBadgeColors


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
