"use client"

import { useEffect } from "react"

export default function EtiquetasError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error("[Etiquetas Error]", error) }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-4xl">📦</div>
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
        Erro ao carregar Etiquetas
      </h2>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {error.message || "Ocorreu um erro inesperado."}
      </p>
      <button onClick={reset}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: "var(--accent)", color: "#fff" }}>
        Tentar novamente
      </button>
    </div>
  )
}
