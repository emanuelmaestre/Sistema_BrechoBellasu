"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { Printer, Download, X, Loader2, AlertCircle } from "lucide-react"

// Busca o PDF da etiqueta via proxy do próprio backend (/api/etiquetas/imprimir
// devolve os bytes do PDF, não uma URL do Melhor Envio) e exibe embutido no
// modal via <iframe>. O navegador nunca navega para o domínio do Melhor Envio.
// Reutilizado na página de etiquetas e na aba "Etiquetas" do cadastro do cliente.
export function EtiquetaPDFModal({ orderId, carrier = "melhorenvio", onClose }: { orderId: string; carrier?: string; onClose: () => void }) {
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando")
  const [url, setUrl] = useState<string | null>(null)
  const [erro, setErro] = useState("")

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  useEffect(() => {
    let ativo = true
    let blobUrlCriada: string | null = null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado("carregando")
    setUrl(null)
    setErro("")

    fetch(`/api/etiquetas/imprimir?order_id=${encodeURIComponent(orderId)}&carrier=${encodeURIComponent(carrier)}`, { method: "GET" })
      .then(async (res) => {
        if (!ativo) return
        if (res.ok && res.headers.get("content-type")?.includes("pdf")) {
          const blob = await res.blob()
          blobUrlCriada = URL.createObjectURL(blob)
          setUrl(blobUrlCriada)
          setEstado("pronto")
          return
        }
        const data = await res.json().catch(() => ({}))
        setErro(data?.erro ?? "Não foi possível obter a etiqueta.")
        setEstado("erro")
      })
      .catch(() => {
        if (!ativo) return
        setErro("Falha ao conectar com o servidor.")
        setEstado("erro")
      })

    return () => { ativo = false; if (blobUrlCriada) URL.revokeObjectURL(blobUrlCriada) }
  }, [orderId])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        className="w-full max-w-2xl h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Printer size={16} style={{ color: "var(--accent)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Etiqueta de Envio</span>
          </div>
          <div className="flex items-center gap-1">
            {estado === "pronto" && url && (
              <a href={url} download={`etiqueta-${orderId}.pdf`}
                title="Baixar PDF"
                className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
                onMouseEnter={f => { (f.currentTarget as HTMLAnchorElement).style.color = "var(--accent)" }}
                onMouseLeave={f => { (f.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)" }}>
                <Download size={16} />
              </a>
            )}
            <button onClick={onClose} title="Fechar"
              className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
              onMouseEnter={f => { (f.currentTarget as HTMLButtonElement).style.color = "#f87171" }}
              onMouseLeave={f => { (f.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="flex-1 min-h-0">
          {estado === "carregando" && (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Buscando etiqueta...</p>
            </div>
          )}

          {estado === "pronto" && url && (
            <iframe src={url} title="Etiqueta de envio" className="w-full h-full border-0" style={{ background: "#525659" }} />
          )}

          {estado === "erro" && (
            <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-red-500/15">
                <AlertCircle size={22} style={{ color: "#f87171" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Não foi possível abrir a etiqueta
                </p>
                <p className="text-xs mt-1 max-w-[280px]" style={{ color: "var(--text-muted)" }}>{erro}</p>
              </div>
              <button onClick={onClose}
                className="px-5 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Fechar
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
