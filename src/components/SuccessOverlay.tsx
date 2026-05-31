"use client"
import { motion, AnimatePresence } from "motion/react"
import { Check } from "lucide-react"

interface SuccessOverlayProps {
  show: boolean
  titulo: string
  subtitulo?: string
}

export function SuccessOverlay({ show, titulo, subtitulo }: SuccessOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6"
          style={{ background: "var(--bg-base)" }}>
          {/* Circulo pulsante */}
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.5, times: [0, 0.6, 1] }}
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--accent), #34d399)" }}>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25, type: "spring", stiffness: 400 }}>
                <Check size={42} color="#fff" strokeWidth={3} />
              </motion.div>
            </motion.div>
            {/* Ondas */}
            {[0, 1, 2].map(i => (
              <motion.div key={i}
                className="absolute inset-0 rounded-full"
                style={{ border: "2px solid var(--accent)", opacity: 0 }}
                animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
                transition={{ delay: 0.3 + i * 0.2, duration: 0.8, repeat: 1, ease: "easeOut" }}
              />
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-center">
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {titulo}
            </p>
            {subtitulo && (
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {subtitulo}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
