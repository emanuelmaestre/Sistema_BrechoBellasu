"use client"

import { useEffect } from "react"
import { motion } from "motion/react"
import { Printer, ExternalLink, X } from "lucide-react"

// Exibe o PDF da etiqueta embutido no sistema (iframe via proxy da nossa API),
// sem redirecionar para o Melhor Envio. Reutilizado na página de etiquetas e
// na aba "Etiquetas" do cadastro do cliente.
export function EtiquetaPDFModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const src = `/api/etiquetas/imprimir?order_id=${encodeURIComponent(orderId)}`

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        className="w-full max-w-3xl h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Printer size={16} style={{ color: "var(--accent)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Etiqueta de Envio</span>
          </div>
          <div className="flex items-center gap-1">
            <a href={src} target="_blank" rel="noopener noreferrer"
              title="Abrir em nova aba"
              className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
              onMouseEnter={f => { (f.currentTarget as HTMLAnchorElement).style.color = "var(--accent)" }}
              onMouseLeave={f => { (f.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)" }}>
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} title="Fechar"
              className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
              onMouseEnter={f => { (f.currentTarget as HTMLButtonElement).style.color = "#f87171" }}
              onMouseLeave={f => { (f.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
              <X size={16} />
            </button>
          </div>
        </div>
        <iframe src={src} title="Etiqueta" className="flex-1 w-full" style={{ background: "#fff", border: "none" }} />
      </motion.div>
    </motion.div>
  )
}
