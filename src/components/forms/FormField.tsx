"use client"

import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, required, error, children, className }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
        {required && (
          <span className="ml-1" style={{ color: "var(--accent)" }}>*</span>
        )}
      </label>
      {children}
      {error && (
        <p className="text-xs font-medium" style={{ color: "var(--color-error, #f87171)" }}>
          {error}
        </p>
      )}
    </div>
  )
}
