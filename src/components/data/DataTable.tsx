"use client"

import React from "react"
import { Loader2 } from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: keyof T | string
  header: string
  width?: string
  align?: "left" | "center" | "right"
  render?: (row: T, idx: number) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  keyField?: keyof T
  className?: string
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  emptyMessage = "Nenhum item encontrado.",
  onRowClick,
  keyField,
  className,
}: DataTableProps<T>) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    )
  }

  if (!data.length) {
    return <EmptyState title={emptyMessage} />
  }

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider",
                  alignClass[col.align ?? "left"],
                )}
                style={{ color: "var(--text-muted)", width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const rowKey = keyField ? String(row[keyField]) : idx
            return (
              <tr
                key={rowKey}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "transition-colors",
                  onRowClick && "cursor-pointer",
                )}
                style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={(e) => {
                  if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)"
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background = "transparent"
                }}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={cn("px-4 py-3", alignClass[col.align ?? "left"])}
                    style={{ color: "var(--text-primary)" }}
                  >
                    {col.render
                      ? col.render(row, idx)
                      : String(row[col.key as keyof T] ?? "—")}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
