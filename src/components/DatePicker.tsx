"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react"
import { cn } from "@/lib/utils"

// ── helpers ──────────────────────────────────────────────
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]

function parseISO(v: string): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const [y, m, d] = v.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function fmtDisplay(iso: string) {
  const d = parseISO(iso)
  if (!d) return ""
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

// ── Helpers texto DD/MM/AAAA ─────────────────────────────
function maskDate(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`
}

function parseBR(v: string): string | null {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const day = parseInt(m[1]), month = parseInt(m[2])-1, year = parseInt(m[3])
  const dt = new Date(year, month, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month || dt.getDate() !== day) return null
  return toISO(dt)
}

// ── Tipos ────────────────────────────────────────────────
interface DatePickerProps {
  value: string            // formato ISO: "2026-05-25"
  onChange: (iso: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  inputClassName?: string  // para compatibilidade com o iBase existente
  min?: string
  max?: string
  disabled?: boolean
  /** Exibe input de texto editável (DD/MM/AAAA) com calendário como opção secundária */
  textFirst?: boolean
  textInputRef?: React.RefObject<HTMLInputElement | null>
}

// ── Componente ────────────────────────────────────────────
export default function DatePicker({
  value, onChange, placeholder = "DD/MM/AAAA",
  className, style, inputClassName, min, max, disabled,
  textFirst, textInputRef,
}: DatePickerProps) {
  const today = new Date()
  const parsed = parseISO(value)
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth())
  const [mode, setMode] = useState<"days" | "months" | "years">("days")
  const [yearPage, setYearPage] = useState(Math.floor((parsed?.getFullYear() ?? today.getFullYear()) / 12) * 12)
  const [typed, setTyped] = useState(value ? fmtDisplay(value) : "")
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync typed quando value muda externamente (ex: clear ou calendário)
  useEffect(() => {
    setTyped(value ? fmtDisplay(value) : "")
  }, [value])

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Sync view quando o valor muda externamente
  useEffect(() => {
    if (parsed) { setViewYear(parsed.getFullYear()); setViewMonth(parsed.getMonth()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }, [viewMonth])

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }, [viewMonth])

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day)
    const iso = toISO(d)
    if (min && iso < min) return
    if (max && iso > max) return
    onChange(iso)
    setOpen(false)
    setMode("days")
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange("")
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay    = getFirstDayOfWeek(viewYear, viewMonth)
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1)
  // pad to full rows of 7
  while (cells.length % 7 !== 0) cells.push(null)

  const todayISO = toISO(today)
  const minDate  = min  ? parseISO(min)  : null
  const maxDate  = max  ? parseISO(max)  : null

  function isDisabledDay(day: number) {
    const iso = toISO(new Date(viewYear, viewMonth, day))
    if (minDate && iso < toISO(minDate)) return true
    if (maxDate && iso > toISO(maxDate)) return true
    return false
  }

  // Anos para o seletor de anos
  const years = Array.from({ length: 12 }, (_, i) => yearPage + i)

  return (
    <div ref={containerRef} className={cn("relative", className)} style={style}>
      {/* Input visual — modo texto-primeiro */}
      {textFirst ? (
        <div className={cn(
          "flex items-center gap-3 border-2 transition-all",
          inputClassName ?? "w-full px-5 py-4 text-lg rounded-2xl",
          disabled && "opacity-50 cursor-not-allowed"
        )} style={{ background: "var(--bg-surface)", borderColor: open ? "var(--accent)" : "var(--border)" }}>
          <input
            ref={textInputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={typed}
            disabled={disabled}
            placeholder={placeholder}
            onChange={e => {
              const masked = maskDate(e.target.value)
              setTyped(masked)
              if (masked.length === 10) {
                const iso = parseBR(masked)
                if (iso && (!max || iso <= max) && (!min || iso >= min)) {
                  onChange(iso)
                  setViewYear(parseInt(iso.slice(0,4)))
                  setViewMonth(parseInt(iso.slice(5,7))-1)
                }
              } else {
                onChange("")
              }
            }}
            className="flex-1 bg-transparent outline-none text-base"
            style={{ color: typed ? "var(--text-primary)" : "var(--text-muted)" }}
          />
          <button
            type="button"
            onClick={() => { if (!disabled) { setOpen(o => !o); setMode("days") } }}
            className="p-1 rounded-xl transition-colors"
            style={{ color: open ? "var(--accent)" : "var(--text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = open ? "var(--accent)" : "var(--text-muted)" }}>
            <CalendarDays size={18} />
          </button>
          {value && !disabled && (
            <button onClick={clear} className="p-0.5 rounded-full transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        /* Input visual clássico */
        <div
          onClick={() => { if (!disabled) { setOpen(o => !o); setMode("days") } }}
          className={cn(
            "flex items-center gap-3 cursor-pointer select-none transition-all",
            inputClassName ?? "w-full px-5 py-4 text-lg rounded-2xl border-2",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          style={{
            background: "var(--bg-surface)",
            borderColor: open ? "var(--accent)" : "var(--border)",
            color: value ? "var(--text-primary)" : "var(--text-muted)",
          }}>
          <CalendarDays size={18} style={{ color: open ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }} />
          <span className={cn("flex-1 text-base", !value && "text-sm")}>
            {value ? fmtDisplay(value) : placeholder}
          </span>
          {value && !disabled && (
            <button onClick={clear} className="p-0.5 rounded-full transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Calendário dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, scale: 0.93, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: -12 }}
            transition={{ type: "spring", damping: 22, stiffness: 320, mass: 0.8 }}
            className="absolute left-0 z-[200] mt-2 rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              width: "312px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            }}>

            {/* Header navegação */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <button onClick={mode === "years" ? () => setYearPage(p => p - 12) : prevMonth}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1.5">
                {/* Mês clicável */}
                <button
                  onClick={() => setMode(m => m === "months" ? "days" : "months")}
                  className="px-2.5 py-1 rounded-lg text-sm font-bold transition-colors"
                  style={{
                    color: mode === "months" ? "var(--accent)" : "var(--text-primary)",
                    background: mode === "months" ? "var(--accent-bg)" : "transparent",
                  }}
                  onMouseEnter={e => { if (mode !== "months") (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                  onMouseLeave={e => { if (mode !== "months") (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                  {MESES[viewMonth]}
                </button>
                {/* Ano clicável */}
                <button
                  onClick={() => setMode(m => m === "years" ? "days" : "years")}
                  className="px-2.5 py-1 rounded-lg text-sm font-bold transition-colors"
                  style={{
                    color: mode === "years" ? "var(--accent)" : "var(--text-primary)",
                    background: mode === "years" ? "var(--accent-bg)" : "transparent",
                  }}
                  onMouseEnter={e => { if (mode !== "years") (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                  onMouseLeave={e => { if (mode !== "years") (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                  {viewYear}
                </button>
              </div>

              <button onClick={mode === "years" ? () => setYearPage(p => p + 12) : nextMonth}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                <ChevronRight size={16} />
              </button>
            </div>

            <AnimatePresence mode="wait">

              {/* ── Seleção de Mês ── */}
              {mode === "months" && (
                <motion.div key="months"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.14 }}
                  className="grid grid-cols-3 gap-1.5 p-4">
                  {MESES.map((m, i) => (
                    <button key={m}
                      onClick={() => { setViewMonth(i); setMode("days") }}
                      className="py-2.5 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: i === viewMonth ? "var(--accent)" : "var(--bg-surface)",
                        color: i === viewMonth ? "#fff" : "var(--text-secondary)",
                      }}
                      onMouseEnter={e => { if (i !== viewMonth) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                      onMouseLeave={e => { if (i !== viewMonth) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)" }}>
                      {m.slice(0, 3).toUpperCase()}
                    </button>
                  ))}
                </motion.div>
              )}

              {/* ── Seleção de Ano ── */}
              {mode === "years" && (
                <motion.div key="years"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.14 }}
                  className="grid grid-cols-4 gap-1.5 p-4">
                  {years.map(y => (
                    <button key={y}
                      onClick={() => { setViewYear(y); setYearPage(Math.floor(y/12)*12); setMode("days") }}
                      className="py-2.5 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: y === viewYear ? "var(--accent)" : "var(--bg-surface)",
                        color: y === viewYear ? "#fff" : y === today.getFullYear() ? "var(--accent)" : "var(--text-secondary)",
                        border: y === today.getFullYear() && y !== viewYear ? "1px solid var(--accent)" : "1px solid transparent",
                      }}
                      onMouseEnter={e => { if (y !== viewYear) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                      onMouseLeave={e => { if (y !== viewYear) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)" }}>
                      {y}
                    </button>
                  ))}
                </motion.div>
              )}

              {/* ── Dias ── */}
              {mode === "days" && (
                <motion.div key="days"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.14 }}>
                  {/* Cabeçalho dias da semana */}
                  <div className="grid grid-cols-7 px-3 pt-3 pb-1">
                    {DIAS_SEMANA.map(d => (
                      <div key={d} className="text-center text-[10px] font-bold uppercase"
                        style={{ color: "var(--text-muted)" }}>{d}</div>
                    ))}
                  </div>
                  {/* Grade de dias */}
                  <div className="grid grid-cols-7 gap-0.5 px-3 pb-3">
                    {cells.map((day, idx) => {
                      if (!day) return <div key={idx} />
                      const iso = toISO(new Date(viewYear, viewMonth, day))
                      const isSelected = iso === value
                      const isToday    = iso === todayISO
                      const isDisabled = isDisabledDay(day)
                      return (
                        <motion.button
                          key={idx}
                          onClick={() => !isDisabled && selectDay(day)}
                          whileHover={!isDisabled && !isSelected ? { scale: 1.15 } : {}}
                          whileTap={!isDisabled ? { scale: 0.9 } : {}}
                          className={cn(
                            "h-9 w-full rounded-xl text-sm font-semibold transition-colors flex items-center justify-center",
                            isDisabled && "opacity-30 cursor-not-allowed",
                            !isDisabled && !isSelected && "cursor-pointer",
                          )}
                          style={{
                            background: isSelected
                              ? "var(--accent)"
                              : isToday
                              ? "var(--accent-bg)"
                              : "transparent",
                            color: isSelected
                              ? "#fff"
                              : isToday
                              ? "var(--accent)"
                              : "var(--text-primary)",
                            border: isToday && !isSelected ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                          }}>
                          {day}
                        </motion.button>
                      )
                    })}
                  </div>

                  {/* Atalhos rápidos */}
                  <div className="flex gap-2 px-3 pb-3">
                    {[
                      { label: "Hoje", iso: todayISO },
                      { label: "Amanhã", iso: toISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)) },
                    ].map(s => (
                      <button key={s.label}
                        onClick={() => { onChange(s.iso); setOpen(false) }}
                        className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: value === s.iso ? "var(--accent)" : "var(--bg-surface)",
                          color: value === s.iso ? "#fff" : "var(--text-muted)",
                        }}
                        onMouseEnter={e => { if (value !== s.iso) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                        onMouseLeave={e => { if (value !== s.iso) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)" }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Versão compacta para filtros de tabela ────────────────
export function DatePickerCompact({
  value, onChange, placeholder = "DD/MM/AAAA", className,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  const today = new Date()
  const parsed = parseISO(value)
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth())
  const [mode, setMode] = useState<"days" | "months" | "years">("days")
  const [yearPage, setYearPage] = useState(Math.floor((parsed?.getFullYear() ?? today.getFullYear()) / 12) * 12)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  useEffect(() => {
    if (parsed) { setViewYear(parsed.getFullYear()); setViewMonth(parsed.getMonth()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11) } else setViewMonth(m => m-1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0) } else setViewMonth(m => m+1) }

  function selectDay(day: number) {
    onChange(toISO(new Date(viewYear, viewMonth, day)))
    setOpen(false); setMode("days")
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay    = getFirstDayOfWeek(viewYear, viewMonth)
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1)
  while (cells.length % 7 !== 0) cells.push(null)
  const todayISO = toISO(today)
  const years = Array.from({ length: 12 }, (_, i) => yearPage + i)

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        onClick={() => { setOpen(o => !o); setMode("days") }}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
        style={{
          background: "var(--bg-surface)",
          border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
          color: value ? "var(--text-primary)" : "var(--text-muted)",
          minWidth: "120px",
        }}>
        <CalendarDays size={13} style={{ color: open ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }} />
        <span className="flex-1 text-left">{value ? fmtDisplay(value) : placeholder}</span>
        {value && (
          <span onClick={e => { e.stopPropagation(); onChange("") }}
            className="p-0.5 rounded cursor-pointer" style={{ color: "var(--text-muted)" }}>
            <X size={11} />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="cal-compact"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 z-[200] mt-1.5 rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              width: "280px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
            }}>

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <button onClick={mode === "years" ? () => setYearPage(p => p-12) : prevMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                <ChevronLeft size={14} />
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => setMode(m => m === "months" ? "days" : "months")}
                  className="px-2 py-0.5 rounded-lg text-xs font-bold transition-colors"
                  style={{ color: mode === "months" ? "var(--accent)" : "var(--text-primary)", background: mode === "months" ? "var(--accent-bg)" : "transparent" }}>
                  {MESES[viewMonth].slice(0,3).toUpperCase()}
                </button>
                <button onClick={() => setMode(m => m === "years" ? "days" : "years")}
                  className="px-2 py-0.5 rounded-lg text-xs font-bold transition-colors"
                  style={{ color: mode === "years" ? "var(--accent)" : "var(--text-primary)", background: mode === "years" ? "var(--accent-bg)" : "transparent" }}>
                  {viewYear}
                </button>
              </div>
              <button onClick={mode === "years" ? () => setYearPage(p => p+12) : nextMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                <ChevronRight size={14} />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {mode === "months" && (
                <motion.div key="m" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="grid grid-cols-3 gap-1 p-3">
                  {MESES.map((m, i) => (
                    <button key={m} onClick={() => { setViewMonth(i); setMode("days") }}
                      className="py-2 rounded-xl text-[10px] font-bold transition-all"
                      style={{ background: i === viewMonth ? "var(--accent)" : "var(--bg-surface)", color: i === viewMonth ? "#fff" : "var(--text-secondary)" }}>
                      {m.slice(0,3).toUpperCase()}
                    </button>
                  ))}
                </motion.div>
              )}
              {mode === "years" && (
                <motion.div key="y" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="grid grid-cols-4 gap-1 p-3">
                  {years.map(y => (
                    <button key={y} onClick={() => { setViewYear(y); setYearPage(Math.floor(y/12)*12); setMode("days") }}
                      className="py-2 rounded-xl text-[10px] font-bold transition-all"
                      style={{ background: y === viewYear ? "var(--accent)" : "var(--bg-surface)", color: y === viewYear ? "#fff" : y === today.getFullYear() ? "var(--accent)" : "var(--text-secondary)" }}>
                      {y}
                    </button>
                  ))}
                </motion.div>
              )}
              {mode === "days" && (
                <motion.div key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="grid grid-cols-7 px-2 pt-2 pb-1">
                    {DIAS_SEMANA.map(d => (
                      <div key={d} className="text-center text-[9px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 px-2 pb-2">
                    {cells.map((day, idx) => {
                      if (!day) return <div key={idx} />
                      const iso = toISO(new Date(viewYear, viewMonth, day))
                      const isSel = iso === value
                      const isT   = iso === todayISO
                      return (
                        <motion.button key={idx} onClick={() => selectDay(day)}
                          whileHover={!isSel ? { scale: 1.2 } : {}}
                          whileTap={{ scale: 0.85 }}
                          className="h-8 w-full rounded-lg text-xs font-semibold transition-colors flex items-center justify-center"
                          style={{
                            background: isSel ? "var(--accent)" : isT ? "var(--accent-bg)" : "transparent",
                            color: isSel ? "#fff" : isT ? "var(--accent)" : "var(--text-primary)",
                            border: isT && !isSel ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                          }}>
                          {day}
                        </motion.button>
                      )
                    })}
                  </div>
                  <div className="flex gap-1.5 px-2 pb-2">
                    {[{ label: "Hoje", iso: todayISO }].map(s => (
                      <button key={s.label} onClick={() => { onChange(s.iso); setOpen(false) }}
                        className="flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all"
                        style={{ background: value === s.iso ? "var(--accent)" : "var(--bg-surface)", color: value === s.iso ? "#fff" : "var(--text-muted)" }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
