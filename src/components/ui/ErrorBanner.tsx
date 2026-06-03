"use client"

import { AlertCircle } from "lucide-react"

interface ErrorBannerProps {
  message: string | null
  className?: string
}

export function ErrorBanner({ message, className }: ErrorBannerProps) {
  if (!message) return null
  return (
    <div
      className={`flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700${className ? ` ${className}` : ""}`}
      role="alert"
    >
      <AlertCircle size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  )
}
