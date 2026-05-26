"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  ShoppingCart, Users, Package, Wallet, RefreshCw,
  BarChart2, Radio, Tag, Globe, Settings,
  LogOut, Sun, Moon, Palette, ArrowRight,
} from "lucide-react"
import { useAuthStore } from "@/stores/auth.store"
import { useThemeStore, type Theme } from "@/stores/theme.store"

// ─── Módulos ──────────────────────────────────────────────
const LEFT = [
  { href: "/vendas",     label: "Vendas",        icon: ShoppingCart, desc: "Registrar e acompanhar vendas",  color: "#10b981", glow: "rgba(16,185,129,0.15)"  },
  { href: "/clientes",   label: "Clientes",      icon: Users,        desc: "Gestão de clientes",             color: "#3b82f6", glow: "rgba(59,130,246,0.15)"  },
  { href: "/produtos",   label: "Produtos",      icon: Package,      desc: "Catálogo e estoque",             color: "#8b5cf6", glow: "rgba(139,92,246,0.15)"  },
  { href: "/financeiro", label: "Financeiro",    icon: Wallet,       desc: "Contas a pagar e receber",       color: "#f59e0b", glow: "rgba(245,158,11,0.15)"  },
  { href: "/trocas",     label: "Trocas e Devoluções", icon: RefreshCw, desc: "Trocas e devoluções",           color: "#ef4444", glow: "rgba(239,68,68,0.15)"   },
]

const RIGHT = [
  { href: "/relatorios",    label: "Relatórios",   icon: BarChart2, desc: "Análises e indicadores",   color: "#06b6d4", glow: "rgba(6,182,212,0.15)"   },
  { href: "/live",          label: "Live",          icon: Radio,     desc: "Transmissões ao vivo",     color: "#e11d48", glow: "rgba(225,29,72,0.15)"   },
  { href: "/etiquetas",     label: "Etiquetas",     icon: Tag,       desc: "Impressão de etiquetas",   color: "#f97316", glow: "rgba(249,115,22,0.15)"  },
  { href: "/site",          label: "Site",          icon: Globe,     desc: "Vitrine online",           color: "#14b8a6", glow: "rgba(20,184,166,0.15)"  },
  { href: "/configuracoes", label: "Configurações", icon: Settings,  desc: "Ajustes do sistema",       color: "#64748b", glow: "rgba(100,116,139,0.15)" },
]

// ─── Temas ─────────────────────────────────────────────────
const THEMES: { value: Theme; label: string; dot: string }[] = [
  { value: "light", label: "Light", dot: "bg-white border-slate-300"       },
  { value: "dark",  label: "Dark",  dot: "bg-slate-800 border-slate-600"   },
  { value: "blue",  label: "Blue",  dot: "bg-indigo-900 border-indigo-500" },
]

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark")  return <Moon    size={13} />
  if (theme === "blue")  return <Palette size={13} />
  return                        <Sun     size={13} />
}

// ─── Card ──────────────────────────────────────────────────
function ModuleCard({
  href, label, icon: Icon, desc, color, glow, delay, onNavigate,
}: {
  href: string; label: string; icon: React.ElementType
  desc: string; color: string; glow: string; delay: number
  onNavigate: (href: string, color: string) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.018, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => onNavigate(href, color)}
      className="relative flex items-center w-full h-full
                 gap-2 px-2.5 py-0 rounded-xl
                 sm:gap-3 sm:px-4
                 lg:gap-4 lg:px-5 lg:rounded-2xl
                 text-left overflow-hidden"
      style={{
        background:  "var(--bg-card)",
        border:      `1.5px solid ${hovered ? color : "var(--border)"}`,
        boxShadow:   hovered
          ? `0 6px 24px ${glow}, 0 2px 6px rgba(0,0,0,0.1)`
          : "var(--shadow-sm)",
        cursor: "pointer",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      {/* Glow */}
      <AnimatePresence>
        {hovered && (
          <motion.div key="bg"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 0% 50%, ${glow} 0%, transparent 65%)` }}
          />
        )}
      </AnimatePresence>

      {/* Ícone */}
      <motion.div
        animate={{ scale: hovered ? 1.12 : 1 }}
        transition={{ duration: 0.22 }}
        className="shrink-0 relative z-10 flex items-center justify-center rounded-xl sm:rounded-2xl
                   w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14"
        style={{ background: `${color}18`, border: `1.5px solid ${color}40` }}
      >
        <Icon
          className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7"
          style={{ color }}
        />
      </motion.div>

      {/* Texto */}
      <div className="flex-1 min-w-0 relative z-10">
        <p className="font-black tracking-wide truncate uppercase
                      text-sm sm:text-base lg:text-lg leading-tight"
          style={{ color: hovered ? color : "var(--text-primary)", transition: "color 0.2s" }}>
          {label}
        </p>
      </div>

      {/* Seta — só em desktop */}
      <motion.div
        animate={{ x: hovered ? 0 : 5, opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.18 }}
        className="hidden lg:block shrink-0 relative z-10"
        style={{ color }}
      >
        <ArrowRight size={15} />
      </motion.div>

      {/* Linha inferior */}
      <motion.div
        animate={{ scaleX: hovered ? 1 : 0 }}
        initial={{ scaleX: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute bottom-0 left-0 right-0 h-[2px] origin-left"
        style={{ background: color }}
      />
    </motion.button>
  )
}

// ─── Página ────────────────────────────────────────────────
export default function MenuPage() {
  const router  = useRouter()
  const logout  = useAuthStore(s => s.logout)
  const usuario = useAuthStore(s => s.usuario)
  const { theme, setTheme } = useThemeStore()
  const [themeOpen, setThemeOpen] = useState(false)
  const [transitioning, setTransitioning] = useState<{ href: string; color: string } | null>(null)

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  function handleNavigate(href: string, color: string) {
    setTransitioning({ href, color })
  }

  return (
    /*
      h-[100dvh] → altura real do viewport em mobile (sem a barra do browser)
      overflow-hidden → sem scroll externo
    */
    <div className="h-[100dvh] flex flex-col overflow-hidden select-none"
      style={{ background: "var(--bg-base)" }}>

      {/* ── Top Bar ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center shrink-0
                   gap-2 px-3 py-2
                   sm:gap-3 sm:px-5 sm:py-2.5
                   lg:px-6 lg:py-3"
        style={{
          background:   "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
          boxShadow:    "var(--shadow-sm)",
        }}
      >
        {/* Logo */}
        <motion.div whileHover={{ rotate: 8, scale: 1.1 }}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm shrink-0"
          style={{ background: "var(--accent)" }}>
          <span className="text-xs sm:text-sm">🛍️</span>
        </motion.div>

        <div className="leading-tight">
          <p className="font-bold text-xs sm:text-sm" style={{ color: "var(--text-primary)" }}>
            Brechó Bellasu
          </p>
        </div>

        <div className="flex-1" />

        {/* Saudação: md+ only */}
        <div className="hidden md:flex flex-col items-end mr-1">
          <p className="text-sm font-semibold uppercase" style={{ color: "var(--text-primary)" }}>
            {saudacao}, {usuario?.nome?.split(" ")[0] ?? "Usuário"}!
          </p>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            {usuario?.perfil ?? ""}
          </p>
        </div>

        {/* Nome: sm-md */}
        <p className="hidden sm:block md:hidden text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}>
          {usuario?.nome?.split(" ")[0] ?? ""}
        </p>

        {/* Avatar */}
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--accent-bg)", border: "1.5px solid var(--accent)" }}>
          <span className="text-[10px] font-bold uppercase" style={{ color: "var(--accent)" }}>
            {usuario?.nome?.[0] ?? "U"}
          </span>
        </div>

        {/* Theme */}
        <div className="relative">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => setThemeOpen(o => !o)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--accent)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}>
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
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 top-full mt-1.5 z-50 rounded-2xl overflow-hidden min-w-[130px]"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
                  <div className="p-1">
                    {THEMES.map(t => {
                      const active = theme === t.value
                      return (
                        <button key={t.value}
                          onClick={() => { setTheme(t.value); setThemeOpen(false) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all"
                          style={{ background: active ? "var(--accent-bg)" : "transparent", color: active ? "var(--accent)" : "var(--text-secondary)" }}
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
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={handleLogout} title="Sair"
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#f87171" }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}>
          <LogOut size={13} />
        </motion.button>
      </motion.div>

      {/* ── Grid ────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col
                      px-2 py-2 gap-2
                      sm:px-4 sm:py-3 sm:gap-2.5
                      lg:px-6 lg:py-4 lg:gap-3">

        {/* 2 colunas × 5 linhas — flex-1 + min-h-0 garante que preenche sem overflow */}
        <div className="flex-1 min-h-0 grid grid-cols-2 gap-2 sm:gap-2.5 lg:gap-3">

          {/* Esquerda */}
          <div className="grid grid-rows-5 gap-2 sm:gap-2.5 lg:gap-3 min-h-0">
            {LEFT.map((m, i) => (
              <ModuleCard key={m.href} {...m} delay={0.06 + i * 0.05} onNavigate={handleNavigate} />
            ))}
          </div>

          {/* Direita */}
          <div className="grid grid-rows-5 gap-2 sm:gap-2.5 lg:gap-3 min-h-0">
            {RIGHT.map((m, i) => (
              <ModuleCard key={m.href} {...m} delay={0.09 + i * 0.05} onNavigate={handleNavigate} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Overlay de transição ─────────────────────── */}
      <AnimatePresence>
        {transitioning && (
          <motion.div
            key="overlay"
            className="fixed inset-0 z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
            onAnimationComplete={() => router.push(transitioning.href)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
