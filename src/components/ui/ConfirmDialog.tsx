"use client"

import { AnimatePresence, motion } from "motion/react"
import { LoadingSpinner } from "./LoadingSpinner"

interface ConfirmDialogProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning"
}

export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  loading = false,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
}: ConfirmDialogProps) {
  const confirmClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-amber-500 hover:bg-amber-600 text-white"

  return (
    <AnimatePresence>
      <motion.div
        key="confirm-dialog"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.15 }}
        className="rounded-md border border-gray-200 bg-white p-4 shadow-md"
      >
        <p className="mb-3 text-sm text-gray-700">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${confirmClass}`}
          >
            {loading && <LoadingSpinner size={14} />}
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
