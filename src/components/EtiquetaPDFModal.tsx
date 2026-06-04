"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { Printer, ExternalLink, X, Loader2, AlertCircle } from "lucide-react"

// Busca a URL de impressão via API e abre diretamente no Melhor Envio.
// Reutilizado na página de etiquetas e na aba "Etiquetas" do cadastro do cliente.
export function EtiquetaPDFModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando")
  const [url, setUrl] = useState<string | null>(null)
  const [erro, setErro] = useState("")

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  // Busca a URL de impressão assim que o modal abre
  useEffect(() => {
    let ativo = true
    setEstado("carregando")
    setUrl(null)
    setErro("")

    fetch(`/api/etiquetas/imprimir?order_id=${encodeURIComponent(orderId)}`, {
      method: "GET",
    })
      .then(async (res) => {
        if (!ativo) return
        // A rota GET faz proxy do PDF — se retornar PDF direto, abre URL proxy
        if (res.ok && res.headers.get("content-type")?.includes("pdf")) {
          // Cria um blob URL para abrir o PDF
          const blob = await res.blob()
          const blobUrl = URL.createObjectURL(blob)
          setUrl(blobUrl)
          setEstado("pronto")
          return
        }
        // Se não for PDF, tenta pegar a URL do JSON
        const data = await res.json().catch(() => ({}))
        if (data?.url) {
          setUrl(data.url)
          setEstado("pronto")
        } else if (data?.erro) {
          setErro(data.erro)
          setEstado("erro")
        } else {
          setErro("Não foi possível obter a URL da etiqueta.")
          setEstado("erro")
        }
      })
      .catch(() => {
        if (!ativo) return
        setErro("Falha ao conectar com o servidor.")
        setEstado("erro")
      })

    return () => { ativo = false }
  }, [orderId])

  // Assim que a URL estiver pronta, abre automaticamente em nova aba
  useEffect(() => {
    if (estado === "pronto" && url) {
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }, [estado, url])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Printer size={16} style={{ color: "var(--accent)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Etiqueta de Envio</span>
          </div>
          <button onClick={onClose} title="Fechar"
            className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
            onMouseEnter={f => { (f.currentTarget as HTMLButtonElement).style.color = "#f87171" }}
            onMouseLeave={f => { (f.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-8 text-center">
          {estado === "carregando" && (
            <>
              <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Buscando etiqueta...</p>
            </>
          )}

          {estado === "pronto" && url && (
            <>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-emerald-500/15">
                <Printer size={22} style={{ color: "#10b981" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Etiqueta aberta em nova aba!
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Se não abriu automaticamente, clique no botão abaixo.
                </p>
              </div>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "var(--accent)", color: "#fff" }}>
                <ExternalLink size={14} /> Abrir etiqueta
              </a>
            </>
          )}

          {estado === "erro" && (
            <>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-red-500/15">
                <AlertCircle size={22} style={{ color: "#f87171" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Não foi possível abrir a etiqueta
                </p>
                <p className="text-xs mt-1 max-w-[240px]" style={{ color: "var(--text-muted)" }}>{erro}</p>
              </div>
              <button onClick={onClose}
                className="px-5 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Fechar
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
