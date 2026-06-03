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
      className={`flex flex-col items-center justify-center gap-3 py-16 text-center text-gray-500${className ? ` ${className}` : ""}`}
    >
      <span className="text-gray-300">
        {icon ?? <ShoppingBag size={48} strokeWidth={1.5} />}
      </span>
      <p className="text-base font-medium text-gray-600">{title}</p>
      {description && <p className="max-w-sm text-sm">{description}</p>}
    </div>
  )
}
