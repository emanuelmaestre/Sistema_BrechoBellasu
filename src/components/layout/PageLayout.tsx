"use client"

import { cn } from "@/lib/utils"

interface PageLayoutProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function PageLayout({ title, subtitle, actions, children, className }: PageLayoutProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:gap-6 p-4 sm:p-6", className)}>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-xl font-bold leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-sm mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
