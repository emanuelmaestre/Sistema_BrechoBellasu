"use client"

import { ReactNode } from "react"
import { ShoppingBag } from "lucide-react"

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  className?: string
}

export function EmptyState({ icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-16 text-center${className ? ` ${className}` : ""}`}
      style={{ color: "var(--text-muted)" }}
    >
      <span style={{ color: "var(--border-hover)" }}>
        {icon ?? <ShoppingBag size={48} strokeWidth={1.5} />}
      </span>
      <p className="text-base font-medium" style={{ color: "var(--text-secondary)" }}>{title}</p>
      {description && <p className="max-w-sm text-sm">{description}</p>}
    </div>
  )
}
