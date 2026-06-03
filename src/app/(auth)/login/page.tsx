"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion, AnimatePresence, useMotionValue, useSpring } from "motion/react"
import { Eye, EyeOff, Loader2, Sparkles } from "lucide-react"
import { useAuthStore } from "@/stores/auth.store"
import { apiPost } from "@/services/api"
import { cn } from "@/lib/utils"
import type { Usuario } from "@/types"

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Senha obrigatória"),
})

type LoginForm = z.infer<typeof loginSchema>

interface LoginResponse {
  usuario: Usuario
}

// Slogan partido em palavras para animação staggered
const SLOGAN_WORDS = ["O", "Desapego", "é", "o", "esporte", "da", "felicidade"]

// Partícula flutuante decorativa
function Particle({ x, y, delay, size }: { x: string; y: string; delay: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: x, top: y, width: size, height: size, background: "rgba(139,92,246,0.25)" }}
      animate={{ y: [0, -18, 0], opacity: [0.3, 0.7, 0.3], scale: [1, 1.2, 1] }}
      transition={{ duration: 4 + delay, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  )
}

export default function LoginPage() {
  const router   = useRouter()
  const setUsuario = useAuthStore((s) => s.setUsuario)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [entered, setEntered] = useState(false)

  // Entrada com atraso para orquestrar animações
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 100)
    return () => clearTimeout(t)
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginForm) {
    setError("")
    try {
      const res = await apiPost<LoginResponse>("/auth/login", values)
      setUsuario(res.usuario)
      router.replace("/menu")
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { erro?: string } } })?.response?.data?.erro
      setError(msg || "E-mail ou senha incorretos.")
    }
  }

  const features = [
    { icon: "💰", label: "Vendas & Caixa", color: "#f59e0b" },
    { icon: "👥", label: "Clientes & CRM", color: "#8b5cf6" },
    { icon: "🔴", label: "Live Commerce", color: "#ef4444" },
    { icon: "🌐", label: "E-commerce", color: "#3b82f6" },
  ]

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: "#080b14" }}>

      {/* ── Fundo animado ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Gradient orbs */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", top: "-10%", left: "-10%" }}
          animate={{ scale: [1, 1.08, 1], x: [0, 20, 0], y: [0, 10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)", bottom: "-5%", right: "-5%" }}
          animate={{ scale: [1, 1.1, 1], x: [0, -15, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        {/* Partículas */}
        {entered && (
          <>
            <Particle x="15%" y="20%" delay={0}   size={6} />
            <Particle x="8%"  y="60%" delay={1.5} size={4} />
            <Particle x="25%" y="80%" delay={0.8} size={5} />
            <Particle x="5%"  y="40%" delay={2.2} size={3} />
            <Particle x="20%" y="50%" delay={3}   size={7} />
          </>
        )}
        {/* Grid sutil */}
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />
      </div>

      {/* ── Painel esquerdo — branding ── */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 relative z-10 px-14 py-16"
        style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <motion.div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-7 relative"
            style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(139,92,246,0.2) 100%)", border: "1px solid rgba(99,102,241,0.4)" }}
            whileHover={{ scale: 1.05 }}
            animate={{ boxShadow: ["0 0 0px rgba(99,102,241,0)", "0 0 24px rgba(99,102,241,0.35)", "0 0 0px rgba(99,102,241,0)"] }}
            transition={{ boxShadow: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}>
            <span className="text-3xl">🛍️</span>
          </motion.div>
          <h1 className="text-5xl font-black tracking-tight leading-[1.05]">
            {/* "Brechó" — letras aparecem uma por uma */}
            <span className="inline-flex overflow-hidden" style={{ color: "#fff" }}>
              {"Brechó".split("").map((l, i) => (
                <motion.span key={i}
                  initial={{ opacity: 0, y: 24, rotateX: -60 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ display: "inline-block", transformOrigin: "bottom center" }}>
                  {l === " " ? " " : l}
                </motion.span>
              ))}
            </span>
            <br />
            {/* "Bellasu" — letras aparecem com gradiente e stagger */}
            <span className="inline-flex overflow-hidden">
              {"Bellasu".split("").map((l, i) => (
                <motion.span key={i}
                  initial={{ opacity: 0, y: 28, rotateX: -80 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ delay: 0.45 + i * 0.07, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    display: "inline-block",
                    transformOrigin: "bottom center",
                    background: "linear-gradient(90deg, #818cf8, #c084fc)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}>
                  {l}
                </motion.span>
              ))}
            </span>
          </h1>
        </motion.div>

        {/* ── SLOGAN ANIMADO ── */}
        <div className="relative">
          {/* Linha decorativa */}
          <motion.div
            className="absolute -left-5 top-0 bottom-0 w-[2px] rounded-full"
            style={{ background: "linear-gradient(180deg, rgba(139,92,246,0.8) 0%, rgba(99,102,241,0.2) 100%)" }}
            initial={{ scaleY: 0, originY: 0 }}
            animate={{ scaleY: entered ? 1 : 0 }}
            transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />


          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {SLOGAN_WORDS.map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                animate={{ opacity: entered ? 1 : 0, y: entered ? 0 : 14, filter: entered ? "blur(0px)" : "blur(4px)" }}
                transition={{ delay: 0.5 + i * 0.09, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "font-bold leading-tight",
                  word === "felicidade"
                    ? "text-2xl"
                    : word === "Desapego" || word === "esporte"
                    ? "text-xl"
                    : "text-xl",
                  word === "felicidade"
                    ? ""
                    : ""
                )}
                style={{
                  color: word === "felicidade"
                    ? "transparent"
                    : word === "Desapego" || word === "esporte"
                    ? "#c4b5fd"
                    : "rgba(255,255,255,0.75)",
                  ...(word === "felicidade" ? {
                    background: "linear-gradient(90deg, #a78bfa, #f0abfc, #818cf8)",
                    WebkitBackgroundClip: "text",
                    fontSize: "1.6rem",
                    fontWeight: 900,
                  } : {}),
                }}>
                {word}
              </motion.span>
            ))}
          </div>

          {/* Sparkle animado */}
          <motion.div
            className="absolute -right-2 -bottom-2"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: entered ? 1 : 0, scale: entered ? 1 : 0, rotate: [0, 20, 0] }}
            transition={{ delay: 1.4, duration: 0.5, rotate: { duration: 4, repeat: Infinity } }}>
            <Sparkles size={18} style={{ color: "#f0abfc" }} />
          </motion.div>
        </div>

        {/* Features */}
        <div className="space-y-2">
          {features.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: entered ? 1 : 0, x: entered ? 0 : -20 }}
              transition={{ delay: 1.2 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 group cursor-default">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}>
                <span className="text-sm">{item.icon}</span>
              </div>
              <span className="text-sm font-medium transition-colors" style={{ color: "rgba(255,255,255,0.45)" }}>
                {item.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Painel direito — formulário ── */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[400px]">

          {/* Logo mobile */}
          <motion.div
            className="lg:hidden text-center mb-8"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}>
            <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-3"
              style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(139,92,246,0.2) 100%)", border: "1px solid rgba(99,102,241,0.4)" }}>
              <span className="text-2xl">🛍️</span>
            </div>
            <h1 className="text-2xl font-extrabold" style={{ color: "#fff" }}>Brechó Bellasu</h1>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>O Desapego é o esporte da felicidade</p>
          </motion.div>

          {/* Card do formulário */}
          <div className="rounded-3xl p-8 relative overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)"
            }}>

            {/* Brilho no topo do card */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[1px]"
              style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)" }} />

            <div className="mb-7">
              <h2 className="text-2xl font-black" style={{ color: "#fff" }}>Entrar no sistema</h2>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>Acesse com suas credenciais</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* E-mail */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                  E-mail
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  {...register("email")}
                  className={cn(
                    "w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all",
                    "placeholder-white/20",
                    errors.email
                      ? "border-red-500/60 bg-red-500/5"
                      : "border-white/10 bg-white/5 focus:border-violet-500/70 focus:bg-white/8"
                  )}
                  style={{ border: "1px solid", color: "#fff" }}
                />
                {errors.email && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-xs mt-1.5">{errors.email.message}</motion.p>
                )}
              </div>

              {/* Senha */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register("senha")}
                    className={cn(
                      "w-full px-4 py-3 pr-12 rounded-2xl text-sm outline-none transition-all",
                      "placeholder-white/20",
                      errors.senha
                        ? "border-red-500/60 bg-red-500/5"
                        : "border-white/10 bg-white/5 focus:border-violet-500/70 focus:bg-white/8"
                    )}
                    style={{ border: "1px solid", color: "#fff", textTransform: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)" }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.senha && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-xs mt-1.5">{errors.senha.message}</motion.p>
                )}
              </div>

              {/* Erro geral */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="rounded-2xl px-4 py-3 text-sm"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Botão */}
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white relative overflow-hidden disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", boxShadow: "0 8px 32px rgba(99,102,241,0.4)" }}>
                {/* Brilho no hover */}
                <motion.div
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)" }}
                  initial={{ x: "-100%" }}
                  animate={isSubmitting ? {} : { x: ["−100%", "200%"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Entrando...</>
                  ) : (
                    "Entrar"
                  )}
                </span>
              </motion.button>
            </form>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-xs mt-6"
            style={{ color: "rgba(255,255,255,0.2)" }}>
            Brechó Bellasu © {new Date().getFullYear()}
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}
