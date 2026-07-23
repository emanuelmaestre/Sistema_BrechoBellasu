"use client"

import { useRouter, usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  LayoutGrid, LogOut, Sun, Moon, Palette,
  ShoppingCart, Users, Package, Wallet,
  RefreshCw, BarChart2, Radio, Tag, Globe, Settings,
  Calculator, CalendarDays, ChevronLeft, ChevronRight, Cake,
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useAuthStore } from "@/stores/auth.store"
import { useThemeStore, type Theme } from "@/stores/theme.store"
import { apiGet } from "@/services/api"

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
interface Aniversariante {
  id: number
  nome: string
  apelido: string | null
  celular: string
  data_nasc: string
  msgEnviada: boolean
}

export function CalendarioWidget() {
  const now = useClock()
  const { open, setOpen, ref } = usePopover()
  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([])

  useEffect(() => {
    apiGet<{ total: number; aniversariantes: Aniversariante[] }>("/aniversariantes/hoje")
      .then(r => setAniversariantes(r.aniversariantes ?? []))
      .catch(() => {})
  }, [])

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

  const totalAniversariantes = aniversariantes.length

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
        {totalAniversariantes > 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black"
            style={{ background: "#fef08a", color: "#854d0e" }}>
            🎂 {totalAniversariantes}
          </span>
        )}
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

            {/* Aniversariantes do dia */}
            {aniversariantes.length > 0 && (
              <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest pt-3 pb-2 flex items-center gap-1.5"
                  style={{ color: "#854d0e" }}>
                  🎂 Aniversariantes de hoje
                </p>
                <div className="flex flex-col gap-1.5">
                  {aniversariantes.map(a => (
                    <div key={a.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl"
                      style={{ background: "#fefce8", border: "1px solid #fef08a" }}>
                      <div>
                        <p className="text-xs font-bold" style={{ color: "#713f12" }}>
                          {a.apelido || a.nome.split(" ")[0]}
                        </p>
                        <p className="text-[10px]" style={{ color: "#a16207" }}>{a.celular}</p>
                      </div>
                      {a.msgEnviada
                        ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#166534" }}>✓ enviada</span>
                        : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fef9c3", color: "#854d0e" }}>pendente</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Widget 2: Aniversariantes ────────────────────────────
function calcularIdade(dataNasc: string): number {
  const [ano, mes, dia] = dataNasc.split("-").map(Number)
  const hoje = new Date()
  let idade = hoje.getFullYear() - ano
  if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) idade--
  return idade
}

export function AniversariantesWidget() {
  const { open, setOpen, ref } = usePopover()
  const [lista, setLista] = useState<Aniversariante[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    apiGet<{ total: number; aniversariantes: Aniversariante[] }>("/aniversariantes/hoje")
      .then(r => setLista(r.aniversariantes ?? []))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const total = lista.length
  const temAniversariantes = total > 0

  function abrirWhatsApp(celular: string, nome: string) {
    const num = celular.replace(/\D/g, "")
    const texto = encodeURIComponent(`Olá ${nome}! 🎂🎉`)
    window.open(`https://wa.me/55${num}?text=${texto}`, "_blank")
  }

  return (
    <div className="relative" ref={ref}>
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
        title="Aniversariantes de hoje"
        className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all select-none"
        style={{
          background: open ? "rgba(251,191,36,0.15)" : "var(--bg-surface)",
          border: `1px solid ${open ? "#f59e0b" : temAniversariantes ? "rgba(251,191,36,0.5)" : "var(--border)"}`,
          color: open || temAniversariantes ? "#b45309" : "var(--text-muted)",
        }}
      >
        {/* Pulso quando há aniversariantes */}
        {temAniversariantes && !open && (
          <motion.span
            className="absolute inset-0 rounded-xl pointer-events-none"
            animate={{ boxShadow: ["0 0 0 0px rgba(251,191,36,0.4)", "0 0 0 5px rgba(251,191,36,0)"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <Cake size={13} />
        {temAniversariantes && (
          <span className="text-[11px] font-black tabular-nums">{total}</span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="absolute right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden"
            style={{ width: 320, background: "var(--bg-card)", border: "1.5px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-4"
              style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.03))" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-black" style={{ color: "var(--text-primary)" }}>
                    🎂 Aniversariantes
                  </p>
                  <p className="text-[11px] font-medium mt-0.5 uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                  </p>
                </div>
                {temAniversariantes && (
                  <span className="text-2xl font-black" style={{ color: "#b45309" }}>{total}</span>
                )}
              </div>
            </div>

            {/* Lista */}
            <div className="px-4 pb-4 flex flex-col gap-2" style={{ maxHeight: 320, overflowY: "auto" }}>
              {carregando ? (
                <div className="py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                  Carregando...
                </div>
              ) : !temAniversariantes ? (
                <div className="py-8 flex flex-col items-center gap-2">
                  <span className="text-3xl">🎉</span>
                  <p className="text-xs font-medium text-center" style={{ color: "var(--text-muted)" }}>
                    Nenhum aniversário hoje
                  </p>
                </div>
              ) : (
                lista.map((a, i) => {
                  const idade = a.data_nasc ? calcularIdade(a.data_nasc) : null
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-black"
                        style={{ background: "rgba(251,191,36,0.2)", color: "#b45309" }}>
                        {(a.apelido || a.nome)[0].toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                          {a.apelido || a.nome.split(" ")[0]}
                          {idade !== null && (
                            <span className="ml-1.5 font-normal text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {idade} anos
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{a.celular}</p>
                      </div>

                      {/* Status + WhatsApp */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {a.msgEnviada
                          ? <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#166534" }}>✓ enviada</span>
                          : <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fef9c3", color: "#854d0e" }}>pendente</span>
                        }
                        <motion.button
                          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                          onClick={() => abrirWhatsApp(a.celular, a.apelido || a.nome.split(" ")[0])}
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(34,197,94,0.12)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)" }}
                        >
                          WhatsApp
                        </motion.button>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Widget 3: Calculadora ────────────────────────────────
// Desktop Windows → abre a Calculadora nativa via protocolo "calculator:"
// Mobile / tablet / outros → abre calculadora embutida em popover

type CalcOp = "+" | "-" | "×" | "÷" | null

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const check = () => setMobile(window.matchMedia("(pointer: coarse)").matches)
    check()
    window.matchMedia("(pointer: coarse)").addEventListener("change", check)
    return () => window.matchMedia("(pointer: coarse)").removeEventListener("change", check)
  }, [])
  return mobile
}

export function CalculadoraWidget() {
  const isMobile = useIsMobile()
  const { open, setOpen, ref } = usePopover()

  // Estado da calculadora inline
  const [display, setDisplay]   = useState("0")
  const [prev, setPrev]         = useState<number | null>(null)
  const [op, setOp]             = useState<CalcOp>(null)
  const [waitNext, setWaitNext] = useState(false)
  const [history, setHistory]   = useState("")

  function input(digit: string) {
    if (waitNext) { setDisplay(digit); setWaitNext(false); return }
    setDisplay(d => d === "0" && digit !== "." ? digit : d.includes(".") && digit === "." ? d : d.length >= 14 ? d : d + digit)
  }

  function clear() { setDisplay("0"); setPrev(null); setOp(null); setWaitNext(false); setHistory("") }

  function toggleSign() { setDisplay(d => d.startsWith("-") ? d.slice(1) : d === "0" ? d : "-" + d) }

  function percent() {
    const n = parseFloat(display)
    if (prev !== null && op) {
      setDisplay(String(prev * n / 100))
    } else {
      setDisplay(String(n / 100))
    }
    setWaitNext(false)
  }

  function applyOp(nextOp: CalcOp) {
    const cur = parseFloat(display)
    if (prev !== null && op && !waitNext) {
      const res = calcResult(prev, cur, op)
      setDisplay(fmtResult(res))
      setHistory(`${fmtResult(res)} ${nextOp ?? ""}`)
      setPrev(res)
    } else {
      setHistory(`${fmtResult(cur)} ${nextOp ?? ""}`)
      setPrev(cur)
    }
    setOp(nextOp)
    setWaitNext(true)
  }

  function calcResult(a: number, b: number, o: CalcOp): number {
    if (o === "+") return a + b
    if (o === "-") return a - b
    if (o === "×") return a * b
    if (o === "÷") return b === 0 ? 0 : a / b
    return b
  }

  function fmtResult(n: number): string {
    if (!isFinite(n)) return "Erro"
    const s = String(parseFloat(n.toPrecision(12)))
    return s.length > 14 ? n.toExponential(6) : s
  }

  function equals() {
    if (prev === null || op === null) return
    const cur = parseFloat(display)
    const res = calcResult(prev, cur, op)
    setHistory(`${fmtResult(prev)} ${op} ${fmtResult(cur)} =`)
    setDisplay(fmtResult(res))
    setPrev(null); setOp(null); setWaitNext(true)
  }

  function backspace() {
    setDisplay(d => d.length <= 1 || (d.length === 2 && d.startsWith("-")) ? "0" : d.slice(0, -1))
  }

  // Desktop: abre calculadora nativa
  if (!isMobile) {
    return (
      <motion.button
        onClick={() => { window.location.href = "calculator:" }}
        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
        title="Abrir Calculadora do Windows"
        className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
        <Calculator size={14}/>
      </motion.button>
    )
  }

  // Mobile / tablet: calculadora inline em popover
  const BTNS: { label: string; type: "num" | "op" | "eq" | "fn" }[] = [
    { label: "C",   type: "fn" }, { label: "+/-", type: "fn" }, { label: "%", type: "fn" }, { label: "÷", type: "op" },
    { label: "7",   type: "num" }, { label: "8",  type: "num" }, { label: "9", type: "num" }, { label: "×", type: "op" },
    { label: "4",   type: "num" }, { label: "5",  type: "num" }, { label: "6", type: "num" }, { label: "-", type: "op" },
    { label: "1",   type: "num" }, { label: "2",  type: "num" }, { label: "3", type: "num" }, { label: "+", type: "op" },
    { label: "⌫",  type: "fn"  }, { label: "0",  type: "num" }, { label: ".", type: "num" }, { label: "=", type: "eq" },
  ]

  const BG: Record<string, string> = {
    fn: "var(--bg-surface)",
    op: "var(--accent-bg)",
    eq: "var(--accent)",
    num: "var(--bg-card)",
  }
  const FG: Record<string, string> = {
    fn: "var(--text-secondary)",
    op: "var(--accent)",
    eq: "#fff",
    num: "var(--text-primary)",
  }

  function handleBtn(label: string, type: string) {
    if (type === "num") { input(label); return }
    if (type === "op")  { applyOp(label as CalcOp); return }
    if (type === "eq")  { equals(); return }
    if (label === "C")   { clear(); return }
    if (label === "+/-") { toggleSign(); return }
    if (label === "%")   { percent(); return }
    if (label === "⌫")  { backspace(); return }
  }

  return (
    <div className="relative" ref={ref}>
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
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
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="absolute right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden"
            style={{ width: 240, background: "var(--bg-card)", border: "1.5px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
          >
            {/* Display */}
            <div className="px-4 pt-4 pb-3" style={{ background: "linear-gradient(135deg, var(--accent-bg), var(--bg-surface))" }}>
              <p className="text-[10px] font-medium h-4 text-right truncate" style={{ color: "var(--text-muted)" }}>
                {history || " "}
              </p>
              <p className="text-3xl font-black text-right tabular-nums leading-tight break-all"
                style={{ color: "var(--text-primary)", letterSpacing: "-1px", fontSize: display.length > 10 ? "1.25rem" : undefined }}>
                {display}
              </p>
            </div>

            {/* Botões */}
            <div className="grid grid-cols-4 gap-1 p-2">
              {BTNS.map(b => (
                <motion.button
                  key={b.label}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => handleBtn(b.label, b.type)}
                  className="h-12 rounded-xl font-bold text-sm flex items-center justify-center transition-colors"
                  style={{ background: BG[b.type], color: FG[b.type], border: "1px solid var(--border)" }}
                  onMouseEnter={e => { if (b.type !== "eq") (e.currentTarget as HTMLButtonElement).style.opacity = "0.75" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}
                >
                  {b.label}
                </motion.button>
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
      className="flex items-center gap-1.5 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 shrink-0 relative z-20"
      style={{
        background:   "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        boxShadow:    "var(--shadow-sm)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
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
      <div className="h-5 w-px hidden sm:block shrink-0" style={{ background: "var(--border-hover)" }} />

      {/* Module name */}
      {current && (
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <current.Icon size={15} style={{ color: current.color }} />
          <span className="font-semibold text-xs sm:text-sm" style={{ color: "var(--text-primary)" }}>
            {current.label}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Calendário — só sm+ */}
      <div className="hidden sm:block">
        <CalendarioWidget />
      </div>

      {/* Aniversariantes — só sm+ */}
      <div className="hidden sm:block">
        <AniversariantesWidget />
      </div>

      {/* Calculadora — só desktop */}
      <div className="hidden sm:block">
        <CalculadoraWidget />
      </div>

      {/* Voltar ao Menu */}
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={handleGoMenu}
        className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0"
        style={{
          background:   "var(--accent-bg)",
          color:        "var(--accent)",
          border:       "1px solid var(--accent)",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#fff" }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--accent-bg)"; e.currentTarget.style.color = "var(--accent)" }}
      >
        <LayoutGrid size={14} />
        <span className="hidden sm:inline">Menu Principal</span>
      </motion.button>

      {/* Divider */}
      <div className="h-5 w-px hidden sm:block shrink-0" style={{ background: "var(--border-hover)" }} />

      {/* User avatar + nome */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--accent-bg)", border: "1px solid var(--border-hover)" }}>
          <span className="text-xs font-bold uppercase" style={{ color: "var(--accent)" }}>
            {usuario?.nome?.[0] ?? "U"}
          </span>
        </div>
        <span className="text-xs font-medium hidden lg:block" style={{ color: "var(--text-secondary)" }}>
          {(usuario?.nome ?? "—").toUpperCase()}
        </span>
      </div>

      {/* Theme toggle — só sm+ */}
      <div className="relative hidden sm:block">
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
        className="p-1.5 sm:p-2 rounded-lg transition-colors shrink-0"
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
