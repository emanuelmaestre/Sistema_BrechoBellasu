"use client"

import { Loader2 } from "lucide-react"
import { ButtonHTMLAttributes, ReactNode } from "react"

interface LoadingSpinnerProps {
  size?: number
  className?: string
}

export function LoadingSpinner({ size = 20, className }: LoadingSpinnerProps) {
  return <Loader2 className={`animate-spin${className ? ` ${className}` : ""}`} size={size} />
}

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading: boolean
  children: ReactNode
}

export function LoadingButton({ loading, children, disabled, ...rest }: LoadingButtonProps) {
  return (
    <button disabled={loading || disabled} {...rest}>
      {loading ? <LoadingSpinner size={16} className="inline mr-2" /> : null}
      {children}
    </button>
  )
}
