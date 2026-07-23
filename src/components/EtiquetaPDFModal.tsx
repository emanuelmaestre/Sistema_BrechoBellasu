"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { Printer, Download, X, Loader2, AlertCircle, Share2, Bluetooth } from "lucide-react"

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

// Busca o PDF da etiqueta via proxy do próprio backend e exibe no modal.
// Desktop: botão Imprimir → dialog do SO (USB ou qualquer impressora instalada).
// Mobile:  botão Compartilhar → Web Share API → abre no Label Expert / app Beeprt (Bluetooth).
export function EtiquetaPDFModal({ orderId, carrier = "melhorenvio", onClose }: {
  orderId: string
  carrier?: string
  onClose: () => void
}) {
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando")
  const [url, setUrl]       = useState<string | null>(null)
  const [blob, setBlob]     = useState<Blob | null>(null)
  const [erro, setErro]     = useState("")
  const [imprimindo, setImprimindo] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const isMobile  = useIsMobile()
  const canShare  = typeof navigator !== "undefined" && !!navigator.share

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  useEffect(() => {
    let ativo = true
    let blobUrlCriada: string | null = null
    setEstado("carregando"); setUrl(null); setBlob(null); setErro("")

    fetch(`/api/etiquetas/imprimir?order_id=${encodeURIComponent(orderId)}&carrier=${encodeURIComponent(carrier)}`, { method: "GET" })
      .then(async (res) => {
        if (!ativo) return
        if (res.ok && res.headers.get("content-type")?.includes("pdf")) {
          const b = await res.blob()
          blobUrlCriada = URL.createObjectURL(b)
          setBlob(b)
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
  }, [orderId, carrier])

  function imprimir() {
    if (!iframeRef.current?.contentWindow) return
    setImprimindo(true)
    iframeRef.current.contentWindow.focus()
    iframeRef.current.contentWindow.print()
    setTimeout(() => setImprimindo(false), 1500)
  }

  async function compartilhar() {
    if (!blob) return
    setCompartilhando(true)
    try {
      const file = new File([blob], `etiqueta-${orderId}.pdf`, { type: "application/pdf" })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Etiqueta de Envio" })
      } else {
        await navigator.share({ title: "Etiqueta de Envio", url: url! })
      }
    } catch {
      // usuário cancelou o share — não é erro
    } finally {
      setCompartilhando(false)
    }
  }

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
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Printer size={15} style={{ color: "var(--accent)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Etiqueta de Envio</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase"
              style={{ background: carrier === "superfrete" ? "rgba(255,107,0,0.12)" : "rgba(0,180,216,0.12)",
                       color: carrier === "superfrete" ? "#ff6b00" : "#00b4d8" }}>
              {carrier === "superfrete" ? "Super Frete" : "Melhor Envio"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {estado === "pronto" && url && (
              <>
                {/* Baixar */}
                <a href={url} download={`etiqueta-${orderId}.pdf`} title="Baixar PDF"
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={f => { (f.currentTarget as HTMLAnchorElement).style.color = "var(--accent)" }}
                  onMouseLeave={f => { (f.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)" }}>
                  <Download size={15} />
                </a>

                {/* Compartilhar — mobile Bluetooth */}
                {canShare && (
                  <button onClick={compartilhar} disabled={compartilhando}
                    title="Compartilhar / Imprimir via Bluetooth"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    style={{
                      background: isMobile ? "rgba(34,197,94,0.12)" : "var(--bg-surface)",
                      border: `1px solid ${isMobile ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                      color: isMobile ? "#16a34a" : "var(--text-secondary)",
                    }}>
                    {compartilhando
                      ? <Loader2 size={13} className="animate-spin" />
                      : isMobile ? <Bluetooth size={13} /> : <Share2 size={13} />}
                    {isMobile ? "Bluetooth" : "Compartilhar"}
                  </button>
                )}

                {/* Imprimir — desktop USB */}
                {!isMobile && (
                  <button onClick={imprimir} disabled={imprimindo}
                    title="Imprimir (USB / impressora instalada)"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    style={{
                      background: "var(--accent-bg)",
                      border: "1px solid var(--accent)",
                      color: "var(--accent)",
                    }}>
                    {imprimindo ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                    Imprimir
                  </button>
                )}

                {/* No mobile: mostrar Imprimir também (abre dialog nativo) */}
                {isMobile && (
                  <button onClick={imprimir} disabled={imprimindo}
                    title="Imprimir"
                    className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                    style={{ color: "var(--text-muted)" }}>
                    {imprimindo ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                  </button>
                )}
              </>
            )}

            <button onClick={onClose} title="Fechar"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={f => { (f.currentTarget as HTMLButtonElement).style.color = "#f87171" }}
              onMouseLeave={f => { (f.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Dica mobile Bluetooth */}
        {isMobile && estado === "pronto" && (
          <div className="px-4 py-2 text-[11px] font-medium flex items-center gap-1.5 shrink-0"
            style={{ background: "rgba(34,197,94,0.07)", borderBottom: "1px solid rgba(34,197,94,0.15)", color: "#16a34a" }}>
            <Bluetooth size={11} />
            Toque em <strong>Bluetooth</strong> para enviar ao app Beeprt / Label Expert e imprimir na BY-480BT.
          </div>
        )}

        {/* Corpo */}
        <div className="flex-1 min-h-0">
          {estado === "carregando" && (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Buscando etiqueta...</p>
            </div>
          )}

          {estado === "pronto" && url && (
            <iframe
              ref={iframeRef}
              src={url}
              title="Etiqueta de envio"
              className="w-full h-full border-0"
              style={{ background: "#525659" }}
            />
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
