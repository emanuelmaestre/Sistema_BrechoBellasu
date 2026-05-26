"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  ShoppingCart, Users, Package, Wallet, RefreshCw,
  BarChart2, Radio, Globe, Settings, LogOut,
  ChevronLeft, Menu, Tag, Sun, Moon, Palette,
} from "lucide-react"
import { useState, useEffect } from "react"
import { useAuthStore } from "@/stores/auth.store"
import { useThemeStore, type Theme } from "@/stores/theme.store"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/vendas",        label: "Vendas",        icon: ShoppingCart },
  { href: "/clientes",      label: "Clientes",      icon: Users        },
  { href: "/produtos",      label: "Produtos",      icon: Package      },
  { href: "/financeiro",    label: "Financeiro",    icon: Wallet       },
  { href: "/trocas",        label: "Trocas e Dev.", icon: RefreshCw    },
  { href: "/relatorios",    label: "Relatórios",    icon: BarChart2    },
  { href: "/live",          label: "Live",          icon: Radio        },
  { href: "/etiquetas",     label: "Etiquetas",     icon: Tag          },
  { href: "/site",          label: "Site",          icon: Globe        },
  { href: "/configuracoes", label: "Configurações", icon: Settings     },
]

const THEMES: { value: Theme; label: string; dot: string }[] = [
  { value: "light", label: "Light", dot: "bg-white border-slate-300"   },
  { value: "dark",  label: "Dark",  dot: "bg-slate-800 border-slate-600" },
  { value: "blue",  label: "Blue",  dot: "bg-indigo-900 border-indigo-500" },
]

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark")  return <Moon    size={14} />
  if (theme === "blue")  return <Palette size={14} />
  return                        <Sun     size={14} />
}

export function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const logout    = useAuthStore((s) => s.logout)
  const usuario   = useAuthStore((s) => s.usuario)
  const { theme, setTheme } = useThemeStore()
  const [collapsed, setCollapsed] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [navFocusIdx, setNavFocusIdx] = useState(-1)

  useEffect(() => {
    if (collapsed) return
    function handleKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setNavFocusIdx(i => Math.min(i + 1, NAV_ITEMS.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setNavFocusIdx(i => Math.max(i - 1, 0))
      } else if (e.key === "Enter" && navFocusIdx >= 0) {
        e.preventDefault()
        router.push(NAV_ITEMS[navFocusIdx].href)
      } else if (e.key === "Escape") {
        setNavFocusIdx(-1)
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [collapsed, navFocusIdx, router])

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 236 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-screen overflow-hidden shrink-0"
      style={{
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border, var(--border))",
      }}
    >
      {/* ── Header ──────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--sidebar-border, var(--border))" }}
      >
        <AnimatePresence initial={false} mode="wait">
          {!collapsed ? (
            <motion.div
              key="logo-full"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2.5 overflow-hidden min-w-0"
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{ background: "var(--accent)" }}
              >
                <span className="text-sm">🛍️</span>
              </div>
              <div className="leading-tight min-w-0">
                <p className="font-bold text-sm whitespace-nowrap truncate"
                  style={{ color: "var(--sidebar-text, var(--text-primary))" }}>
                  Brechó Bellasu
                </p>
                <p className="text-[10px] whitespace-nowrap"
                  style={{ color: "var(--sidebar-muted, var(--text-muted))" }}>
                  Sistema de Gestão
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="logo-icon"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
              className="mx-auto"
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
                style={{ background: "var(--accent)" }}
              >
                <span className="text-sm">🛍️</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!collapsed && (
          <motion.button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg transition-colors shrink-0 ml-1"
            style={{ color: "var(--sidebar-muted, var(--text-muted))" }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "var(--sidebar-hover-bg, var(--bg-hover))"
              e.currentTarget.style.color = "var(--sidebar-text, var(--text-primary))"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent"
              e.currentTarget.style.color = "var(--sidebar-muted, var(--text-muted))"
            }}
          >
            <ChevronLeft size={15} />
          </motion.button>
        )}

        {collapsed && (
          <motion.button
            onClick={() => setCollapsed(false)}
            className="p-1.5 rounded-lg transition-colors mx-auto mt-2"
            style={{ color: "var(--sidebar-muted, var(--text-muted))" }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "var(--sidebar-hover-bg, var(--bg-hover))"
              e.currentTarget.style.color = "var(--sidebar-text, var(--text-primary))"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent"
              e.currentTarget.style.color = "var(--sidebar-muted, var(--text-muted))"
            }}
          >
            <Menu size={15} />
          </motion.button>
        )}
      </div>

      {/* ── Nav ─────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }, i) => {
          const active = pathname.startsWith(href)
          const focused = navFocusIdx === i
          return (
            <motion.div
              key={href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <Link
                href={href}
                data-nav-idx={i}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all overflow-hidden"
                style={{
                  color: active
                    ? "var(--sidebar-active-text, var(--accent))"
                    : "var(--sidebar-text, var(--text-secondary))",
                  outline: focused ? "2px solid var(--accent)" : "none",
                  outlineOffset: "2px",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = "var(--sidebar-hover-bg, var(--bg-hover))"
                    e.currentTarget.style.color = "var(--sidebar-text, var(--text-primary))"
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent"
                    e.currentTarget.style.color = "var(--sidebar-text, var(--text-secondary))"
                  }
                }}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-pill"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "var(--sidebar-active-bg, var(--accent-bg))" }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ background: "var(--sidebar-active-text, var(--accent))" }}
                  />
                )}
                <Icon size={17} className="relative z-10 shrink-0" />
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      key={`label-${href}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.15 }}
                      className="relative z-10 whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          )
        })}
      </nav>

      {/* ── Footer ──────────────────────────────── */}
      <div
        className="p-2 relative"
        style={{ borderTop: "1px solid var(--sidebar-border, var(--border))" }}
      >
        {/* Theme picker popup */}
        <AnimatePresence>
          {themeOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                className="absolute left-2 bottom-full mb-2 z-50 rounded-2xl overflow-hidden min-w-[148px]"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                <div className="p-1">
                  {THEMES.map((t) => {
                    const isActive = theme === t.value
                    return (
                      <button
                        key={t.value}
                        onClick={() => { setTheme(t.value); setThemeOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all"
                        style={{
                          background: isActive ? "var(--accent-bg)" : "transparent",
                          color: isActive ? "var(--accent)" : "var(--text-secondary)",
                        }}
                        onMouseEnter={e => {
                          if (!isActive) e.currentTarget.style.background = "var(--bg-hover)"
                        }}
                        onMouseLeave={e => {
                          if (!isActive) e.currentTarget.style.background = "transparent"
                        }}
                      >
                        <span className={cn("w-3 h-3 rounded-full border flex-shrink-0", t.dot)} />
                        <span className="font-medium flex-1 text-left">{t.label}</span>
                        {isActive && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            style={{ color: "var(--accent)", fontSize: 11 }}
                          >
                            ✓
                          </motion.span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className={cn(
          "flex items-center gap-2 px-1 py-1",
          collapsed && "flex-col gap-2 justify-center"
        )}>
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: "var(--sidebar-active-bg, var(--accent-bg))",
              border: "1px solid var(--sidebar-border, var(--border-hover))",
            }}
          >
            <span className="text-xs font-bold uppercase"
              style={{ color: "var(--sidebar-active-text, var(--accent))" }}>
              {usuario?.nome?.[0] ?? "U"}
            </span>
          </div>

          {/* User info */}
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="user-info"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0"
              >
                <p className="text-xs font-semibold truncate"
                  style={{ color: "var(--sidebar-text, var(--text-primary))" }}>
                  {usuario?.nome ?? "—"}
                </p>
                <p className="text-[10px] truncate capitalize"
                  style={{ color: "var(--sidebar-muted, var(--text-muted))" }}>
                  {usuario?.perfil ?? ""}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Theme toggle */}
          <motion.button
            onClick={() => setThemeOpen(o => !o)}
            title="Tema"
            className="p-1.5 rounded-lg shrink-0"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{ color: "var(--sidebar-muted, var(--text-muted))" }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "var(--sidebar-hover-bg, var(--bg-hover))"
              e.currentTarget.style.color = "var(--accent)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent"
              e.currentTarget.style.color = "var(--sidebar-muted, var(--text-muted))"
            }}
          >
            <ThemeIcon theme={theme} />
          </motion.button>

          {/* Logout */}
          <motion.button
            onClick={handleLogout}
            title="Sair"
            className="p-1.5 rounded-lg shrink-0"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{ color: "var(--sidebar-muted, var(--text-muted))" }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(239,68,68,0.12)"
              e.currentTarget.style.color = "#f87171"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent"
              e.currentTarget.style.color = "var(--sidebar-muted, var(--text-muted))"
            }}
          >
            <LogOut size={14} />
          </motion.button>
        </div>
      </div>
    </motion.aside>
  )
}
