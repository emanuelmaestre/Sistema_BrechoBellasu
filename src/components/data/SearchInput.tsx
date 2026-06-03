"use client"

import { useState, useEffect } from "react"
import { Search } from "lucide-react"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  debounceMs?: number
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  debounceMs = 300,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const debounced = useDebounce(localValue, debounceMs)

  useEffect(() => {
    onChange(debounced)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  // Sync external resets (e.g. clear button)
  useEffect(() => {
    if (value !== localValue) setLocalValue(value)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search
        size={15}
        className="absolute left-3 pointer-events-none"
        style={{ color: "var(--text-muted)" }}
      />
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none transition-all border"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
        onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)" }}
        onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border)" }}
      />
    </div>
  )
}
