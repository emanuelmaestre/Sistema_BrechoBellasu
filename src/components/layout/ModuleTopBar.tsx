"use client"

import { useRouter, usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  LayoutGrid, LogOut, Sun, Moon, Palette,
  ShoppingCart, Users, Package, Wallet,
  RefreshCw, BarChart2, Radio, Tag, Globe, Settings,
} from "lucide-react"
import { useState } from "react"
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
      className="flex items-center gap-3 px-5 py-3 shrink-0 relative z-20"
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
          {usuario?.nome ?? "—"}
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
