"use client"

// ══════════════════════════════════════════════════════════════════
// Diálogos do sistema — substituem window.confirm/alert do navegador.
// Uso:
//   const confirmar = useConfirm()
//   if (!(await confirmar({ titulo: "Excluir?", perigo: true }))) return
// ══════════════════════════════════════════════════════════════════
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { AlertTriangle, Info, Trash2, HelpCircle, Check, X } from "lucide-react"

export interface ConfirmOptions {
  titulo: string
  descricao?: string
  confirmar?: string
  cancelar?: string
  /** Ação destrutiva: vermelho + ícone de lixeira. */
  perigo?: boolean
  /** Só informa; exibe um único botão (substitui alert). */
  aviso?: boolean
}

type Resolver = (ok: boolean) => void

const Ctx = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null)

export function useConfirm() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useConfirm precisa estar dentro de <ConfirmProvider>")
  return ctx
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<Resolver | null>(null)
  const cancelarRef = useRef<HTMLButtonElement>(null)

  const confirmar = useCallback((o: ConfirmOptions) => {
    setOpts(o)
    return new Promise<boolean>(resolve => { resolverRef.current = resolve })
  }, [])

  const fechar = useCallback((ok: boolean) => {
    resolverRef.current?.(ok)
    resolverRef.current = null
    setOpts(null)
  }, [])

  // Esc cancela; Enter confirma. O foco começa no botão seguro.
  useEffect(() => {
    if (!opts) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); fechar(false) }
      if (e.key === "Enter")  { e.preventDefault(); fechar(true) }
    }
    document.addEventListener("keydown", onKey)
    const t = setTimeout(() => cancelarRef.current?.focus(), 60)
    return () => { document.removeEventListener("keydown", onKey); clearTimeout(t) }
  }, [opts, fechar])

  const cor   = opts?.perigo ? "#ef4444" : opts?.aviso ? "#3b82f6" : "#f59e0b"
  const Icone = opts?.perigo ? Trash2 : opts?.aviso ? Info : HelpCircle

  return (
    <Ctx.Provider value={confirmar}>
      {children}
      <AnimatePresence>
        {opts && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => fechar(false)}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(5px)" }}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.92, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              role="alertdialog" aria-modal="true"
              className="w-full max-w-sm rounded-3xl overflow-hidden"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
            >
              {/* Faixa superior colorida conforme a gravidade */}
              <div style={{ height: 4, background: cor }} />

              <div className="p-6 flex flex-col items-center text-center gap-4">
                {/* Ícone com halo pulsante */}
                <div className="relative">
                  <motion.span
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: cor }}
                    animate={{ opacity: [0.16, 0.32, 0.16], scale: [1, 1.18, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.div
                    initial={{ rotate: -12, scale: 0.7 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.06 }}
                    className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: `${cor}1f`, border: `1px solid ${cor}45` }}
                  >
                    <Icone size={24} style={{ color: cor }} />
                  </motion.div>
                </div>

                <div>
                  <h2 className="text-base font-black leading-snug" style={{ color: "var(--text-primary)" }}>
                    {opts.titulo}
                  </h2>
                  {opts.descricao && (
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {opts.descricao}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 w-full pt-1">
                  {!opts.aviso && (
                    <motion.button
                      ref={cancelarRef}
                      onClick={() => fechar(false)}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                    >
                      <X size={14} /> {opts.cancelar ?? "Cancelar"}
                    </motion.button>
                  )}
                  <motion.button
                    onClick={() => fechar(true)}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white"
                    style={{ background: cor }}
                  >
                    {opts.perigo ? <AlertTriangle size={14} /> : <Check size={14} />}
                    {opts.confirmar ?? (opts.aviso ? "Entendi" : "Confirmar")}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  )
}
