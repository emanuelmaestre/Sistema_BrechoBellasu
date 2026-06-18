"use client"

import { useRouter, usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  LayoutGrid, LogOut, Sun, Moon, Palette,
  ShoppingCart, Users, Package, Wallet,
  RefreshCw, BarChart2, Radio, Tag, Globe, Settings,
  Calculator, Delete, CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useAuthStore } from "@/stores/auth.store"
import { useThemeStore, type Theme } from "@/stores/theme.store"

const ROUTE_LABELS: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  "/vendas":        { label: "Vendas",        Icon: ShoppingCart, color: "#10b981" },
  "/clientes":      { label: "Clientes",      Icon: Users,        color: "#3b82f6" },
  "/produtos":      { label: "Produtos",      Icon: Package,      color: "#8b5cf6" },
  "/financeiro":    { label: "Financeiro",    Icon: Wallet,       color: "#f59e0b" },
  "/trocas":        { label: "Trocas e Dev.", Icon: RefreshCw,    color: "#ef4444" },
  "/relatorios":    { label: "Relatórios",    Icon: BarChart2,    color: "#06b6d4" },
  "/live":          { label: "Live",          Icon: Radio,        color: "#e11d48" },
  "/etiquetas":     { label: "Etiquetas",     Icon: Tag,          color: "#f97316" },
  "/site":          { label: "Site",          Icon: Globe,        color: "#14b8a6" },
  "/configuracoes": { label: "Configurações", Icon: Settings,     color: "#64748b" },
}

const THEMES: { value: Theme; label: string; dot: string }[] = [
  { value: "light", label: "Light", dot: "bg-white border-slate-300"     },
  { value: "dark",  label: "Dark",  dot: "bg-slate-800 border-slate-600" },
  { value: "blue",  label: "Blue",  dot: "bg-indigo-900 border-indigo-500" },
]

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark")  return <Moon    size={14} />
  if (theme === "blue")  return <Palette size={14} />
  return                        <Sun     size={14} />
}

// ── Shared: relógio ao vivo ───────────────────────────────
const DIAS_SEMANA  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]
const DIAS_SEMANA_FULL = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"]
const MESES_ABREV  = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
const MESES_FULL   = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])
  return now
}

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [open])
  return { open, setOpen, ref }
}

// ── Widget 1: Calendário ─────────────────────────────────
export function CalendarioWidget() {
  const now = useClock()
  const { open, setOpen, ref } = usePopover()
  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const hh = now.getHours().toString().padStart(2,"0")
  const mm = now.getMinutes().toString().padStart(2,"0")
  const ss = now.getSeconds().toString().padStart(2,"0")

  const hoje = new Date()
  const primeiroDia = new Date(viewYear, viewMonth, 1).getDay()
  const diasNoMes   = new Date(viewYear, viewMonth + 1, 0).getDate()

  function navMes(dir: number) {
    const d = new Date(viewYear, viewMonth + dir, 1)
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth())
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: primeiroDia }, (): null => null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ]

  return (
    <div className="relative" ref={ref}>
      <motion.button onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all select-none"
        style={{
          background: open ? "var(--accent-bg)" : "var(--bg-surface)",
          border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
          color: open ? "var(--accent)" : "var(--text-secondary)",
        }}>
        <CalendarDays size={12} style={{ opacity: 0.7 }}/>
        <span className="text-xs font-black tabular-nums tracking-wider">{hh}:{mm}</span>
        <span className="text-[10px] font-medium hidden sm:block" style={{ color: "var(--text-muted)", opacity: 0.8 }}>
          {DIAS_SEMANA[now.getDay()]}, {now.getDate().toString().padStart(2,"0")} {MESES_ABREV[now.getMonth()]} {now.getFullYear()}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="absolute right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden"
            style={{ width: 460, background: "var(--bg-card)", border: "1.5px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>

            {/* Header com relógio */}
            <div className="px-5 pt-5 pb-4" style={{ background: "linear-gradient(135deg,var(--accent-bg),var(--bg-surface))" }}>
              <div className="flex items-end justify-between">
                <div>
                  <motion.p key={`${hh}:${mm}`} initial={{ opacity: 0.4, y: 3 }} animate={{ opacity: 1, y: 0 }}
                    className="text-3xl font-black tabular-nums leading-none"
                    style={{ color: "var(--text-primary)", letterSpacing: "-1px" }}>
                    {hh}:{mm}
                    <span className="text-sm font-semibold ml-1" style={{ color: "var(--text-muted)" }}>:{ss}</span>
                  </motion.p>
                  <p className="text-[11px] font-semibold mt-1.5 uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    {DIAS_SEMANA_FULL[now.getDay()]}, {now.getDate()} de {MESES_FULL[now.getMonth()].toLowerCase()} de {now.getFullYear()}
                  </p>
                </div>
                <CalendarDays size={28} style={{ color: "var(--accent)", opacity: 0.35 }}/>
              </div>
            </div>

            {/* Navegação de mês */}
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <motion.button onClick={() => navMes(-1)} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ color: "var(--text-muted)", background: "var(--bg-surface)" }}>
                <ChevronLeft size={13}/>
              </motion.button>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
                {MESES_FULL[viewMonth]} {viewYear}
              </p>
              <motion.button onClick={() => navMes(1)} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ color: "var(--text-muted)", background: "var(--bg-surface)" }}>
                <ChevronRight size={13}/>
              </motion.button>
            </div>

            {/* Grid do calendário */}
            <div className="px-4 py-3">
              {/* Cabeçalho dias da semana */}
              <div className="grid grid-cols-7 mb-1">
                {["D","S","T","Q","Q","S","S"].map((d, i) => (
                  <div key={i} className="text-center text-[11px] font-black uppercase tracking-widest py-1.5"
                    style={{ color: i === 0 || i === 6 ? "var(--accent)" : "var(--text-muted)" }}>{d}</div>
                ))}
              </div>
              {/* Dias */}
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((dia, i) => {
                  if (!dia) return <div key={i}/>
                  const isHoje = dia === hoje.getDate() && viewMonth === hoje.getMonth() && viewYear === hoje.getFullYear()
                  const isSun  = (primeiroDia + dia - 1) % 7 === 0
                  const isSat  = (primeiroDia + dia - 1) % 7 === 6
                  return (
                    <motion.div key={dia} whileHover={{ scale: 1.2 }}
                      className="flex items-center justify-center h-12 rounded-xl text-base font-bold cursor-default"
                      style={{
                        background: isHoje ? "var(--accent)" : "transparent",
                        color: isHoje ? "#fff" : isSun || isSat ? "var(--accent)" : "var(--text-secondary)",
                        fontWeight: isHoje ? 900 : undefined,
                        boxShadow: isHoje ? "0 2px 8px var(--accent-bg)" : undefined,
                      }}>
                      {dia}
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Rodapé: voltar para hoje */}
            <div className="px-4 pb-4">
              <motion.button onClick={() => { setViewYear(hoje.getFullYear()); setViewMonth(hoje.getMonth()) }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                className="w-full py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
                style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                Hoje
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Widget 2: Calculadora ────────────────────────────────
type CalcState = { display: string; prev: string; op: string | null; fresh: boolean }
const CALC_INIT: CalcState = { display: "0", prev: "", op: null, fresh: false }

export function CalculadoraWidget() {
  const { open, setOpen, ref } = usePopover()
  const [calc, setCalc]  = useState<CalcState>(CALC_INIT)
  const [flash, setFlash] = useState(false)

  const calcInput = useCallback((val: string) => {
    setCalc(prev => {
      if (["+","-","×","÷"].includes(val)) {
        const cur = parseFloat(prev.display) || 0
        return { display: prev.display, prev: String(cur), op: val, fresh: true }
      }
      if (val === "%") {
        const cur = parseFloat(prev.display) || 0
        if (prev.op && prev.prev && (prev.op === "+" || prev.op === "-")) {
          // Percentual relativo apenas para + e -: 200 + 10% → 200 + 20
          const base = parseFloat(prev.prev)
          const pct  = base * cur / 100
          return { ...prev, display: parseFloat(pct.toFixed(10)).toString(), fresh: false }
        }
        // Percentual absoluto (× ÷ e sem operador): 300×10% → 300×0.1; 50% → 0.5
        const disp = parseFloat((cur / 100).toFixed(10)).toString()
        return { ...prev, display: disp, fresh: false }
      }
      if (val === "=") {
        if (!prev.op || !prev.prev) return prev
        const a = parseFloat(prev.prev), b = parseFloat(prev.display)
        let res = 0
        if (prev.op === "+") res = a + b
        if (prev.op === "-") res = a - b
        if (prev.op === "×") res = a * b
        if (prev.op === "÷") res = b !== 0 ? a / b : 0
        const disp = parseFloat(res.toFixed(10)).toString()
        setFlash(true); setTimeout(() => setFlash(false), 300)
        return { display: disp, prev: "", op: null, fresh: true }
      }
      if (val === "C") return CALC_INIT
      if (val === "⌫") { const d = prev.display.length > 1 ? prev.display.slice(0,-1) : "0"; return { ...prev, display: d } }
      if (val === ".") { const d = prev.fresh ? "0." : prev.display.includes(".") ? prev.display : prev.display + "."; return { ...prev, display: d, fresh: false } }
      const d = prev.fresh || prev.display === "0" ? val : prev.display + val
      return { ...prev, display: d.slice(0,14), fresh: false }
    })
  }, [])

  // Layout: C | ⌫ | % | ÷
  //         7 | 8 | 9 | ×
  //         4 | 5 | 6 | -
  //         1 | 2 | 3 | +
  //         0(x2) | . | =
  const BTNS = [
    ["C","⌫","%","÷"],
    ["7","8","9","×"],
    ["4","5","6","-"],
    ["1","2","3","+"],
    ["0","0",".","="],
  ]

  return (
    <div className="relative" ref={ref}>
      <motion.button onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
        title="Calculadora"
        className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
        style={{
          background: open ? "var(--accent-bg)" : "var(--bg-surface)",
          border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
          color: open ? "var(--accent)" : "var(--text-muted)",
        }}>
        <Calculator size={14}/>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="absolute right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden"
            style={{ width: 340, background: "var(--bg-card)", border: "1.5px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>

            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg,var(--accent-bg),var(--bg-surface))", borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <Calculator size={14} style={{ color: "var(--accent)" }}/>
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--accent)" }}>Calculadora</span>
              </div>
              <motion.button onClick={() => setCalc(CALC_INIT)} whileHover={{ scale: 1.1 }}
                className="text-[9px] font-black uppercase px-2 py-1 rounded-lg"
                style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
                limpar
              </motion.button>
            </div>

            {/* Display */}
            <div className="px-4 pt-4 pb-2">
              <motion.div animate={flash ? { scale: [1,1.03,1] } : {}} transition={{ duration: 0.2 }}
                className="rounded-xl px-4 py-3 text-right"
                style={{ background: "var(--bg-surface)", border: "1.5px solid var(--border)" }}>
                {calc.op && (
                  <p className="text-xs font-bold mb-0.5 tabular-nums" style={{ color: "var(--accent)", opacity: 0.7 }}>
                    {calc.prev} {calc.op}
                  </p>
                )}
                <motion.p key={calc.display} initial={{ opacity: 0.5, x: 3 }} animate={{ opacity: 1, x: 0 }}
                  className="text-4xl font-black tabular-nums truncate"
                  style={{ color: flash ? "#10b981" : "var(--text-primary)", letterSpacing: "-0.5px" }}>
                  {calc.display}
                </motion.p>
              </motion.div>
            </div>

            {/* Botões */}
            <div className="px-4 pb-4 pt-2 space-y-2">
              {BTNS.map((row, ri) => (
                <div key={ri} className="grid grid-cols-4 gap-2">
                  {row.map((btn, bi) => {
                    // Última linha: 0 ocupa 2 colunas, então pula o segundo "0"
                    if (ri === 4 && bi === 1) return null
                    const isOp   = ["+","-","×","÷"].includes(btn)
                    const isEq   = btn === "="
                    const isClr  = btn === "C"
                    const isDel  = btn === "⌫"
                    const isPct  = btn === "%"
                    const isZero = ri === 4 && bi === 0
                    return (
                      <motion.button key={`${ri}-${bi}`} onClick={() => calcInput(btn)}
                        whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.88 }}
                        transition={{ type: "spring", stiffness: 500, damping: 18 }}
                        className={`${isZero ? "col-span-2" : ""} h-14 rounded-xl text-lg font-black flex items-center justify-center`}
                        style={{
                          background: isEq  ? "var(--accent)"
                                    : isOp  ? "var(--accent-bg)"
                                    : isPct ? "rgba(99,102,241,0.08)"
                                    : isClr ? "rgba(239,68,68,0.1)"
                                    : "var(--bg-surface)",
                          color: isEq  ? "#fff"
                               : isOp  ? "var(--accent)"
                               : isPct ? "var(--accent)"
                               : isClr ? "#f87171"
                               : "var(--text-primary)",
                          border: `1px solid ${isEq ? "var(--accent)" : isOp || isPct ? "var(--accent)" : "var(--border)"}`,
                          boxShadow: isEq ? "0 2px 12px var(--accent-bg)" : "none",
                          fontSize: isDel ? undefined : undefined,
                        }}>
                        {isDel ? <Delete size={15}/> : btn}
                      </motion.button>
                    )
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ModuleTopBar() {
  const router   = useRouter()
  const pathname = usePathname()
  const logout   = useAuthStore(s => s.logout)
  const usuario  = useAuthStore(s => s.usuario)
  const { theme, setTheme } = useThemeStore()
  const [themeOpen, setThemeOpen] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  const basePath = "/" + (pathname.split("/")[1] ?? "")
  const current  = ROUTE_LABELS[basePath]

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  function handleGoMenu() {
    setTransitioning(true)
  }

  return (
    <div
      id="module-topbar"
      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 shrink-0 relative z-20"
      style={{
        background:   "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        boxShadow:    "var(--shadow-sm)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 mr-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--accent)" }}>
          <span className="text-xs">🛍️</span>
        </div>
        <span className="font-bold text-sm hidden sm:block"
          style={{ color: "var(--text-primary)" }}>
          Brechó Bellasu
        </span>
      </div>

      {/* Divider */}
      <div className="h-5 w-px hidden sm:block" style={{ background: "var(--border-hover)" }} />

      {/* Module name */}
      {current && (
        <div className="flex items-center gap-2">
          <current.Icon size={16} style={{ color: current.color }} />
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            {current.label}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Calendário (com relógio) */}
      <CalendarioWidget />

      {/* Calculadora */}
      <CalculadoraWidget />

      {/* Voltar ao Menu */}
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={handleGoMenu}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        style={{
          background:   "var(--accent-bg)",
          color:        "var(--accent)",
          border:       "1px solid var(--accent)",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#fff" }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--accent-bg)"; e.currentTarget.style.color = "var(--accent)" }}
      >
        <LayoutGrid size={15} />
        <span className="hidden sm:inline">Menu Principal</span>
      </motion.button>

      {/* Divider */}
      <div className="h-5 w-px" style={{ background: "var(--border-hover)" }} />

      {/* User avatar */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--accent-bg)", border: "1px solid var(--border-hover)" }}>
          <span className="text-xs font-bold uppercase" style={{ color: "var(--accent)" }}>
            {usuario?.nome?.[0] ?? "U"}
          </span>
        </div>
        <span className="text-xs font-medium hidden md:block" style={{ color: "var(--text-secondary)" }}>
          {(usuario?.nome ?? "—").toUpperCase()}
        </span>
      </div>

      {/* Theme toggle */}
      <div className="relative">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setThemeOpen(o => !o)}
          title="Tema"
          className="p-2 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--accent)" }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
        >
          <ThemeIcon theme={theme} />
        </motion.button>

        <AnimatePresence>
          {themeOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden min-w-[140px]"
                style={{
                  background:  "var(--bg-card)",
                  border:      "1px solid var(--border)",
                  boxShadow:   "var(--shadow-lg)",
                }}
              >
                <div className="p-1">
                  {THEMES.map(t => {
                    const active = theme === t.value
                    return (
                      <button key={t.value}
                        onClick={() => { setTheme(t.value); setThemeOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all"
                        style={{
                          background: active ? "var(--accent-bg)" : "transparent",
                          color:      active ? "var(--accent)"    : "var(--text-secondary)",
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--bg-hover)" }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent" }}>
                        <span className={`w-3 h-3 rounded-full border flex-shrink-0 ${t.dot}`} />
                        <span className="font-medium flex-1 text-left">{t.label}</span>
                        {active && <span style={{ color: "var(--accent)", fontSize: 11 }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Logout */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleLogout}
        title="Sair"
        className="p-2 rounded-lg transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#f87171" }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
      >
        <LogOut size={14} />
      </motion.button>

      {/* ── Overlay de transição → Menu Principal ── */}
      <AnimatePresence>
        {transitioning && (
          <motion.div
            key="menu-overlay"
            className="fixed inset-0 z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
            onAnimationComplete={() => router.push("/menu")}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
