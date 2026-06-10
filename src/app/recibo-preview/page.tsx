"use client"

import { useState } from "react"
import { gerarReciboPDF, type ReciboData } from "@/lib/recibo-pdf"
import { Loader2, Download, Eye } from "lucide-react"

const EXEMPLO: ReciboData = {
  numero: 42,
  tipo: "Venda",
  data: "01/06/2026 14:30",
  cliente_nome: "Maria Silva Santos",
  cliente_celular: "(16) 99999-9999",
  itens: [
    { nome: "Blusa Floral Vintage", cor: "Rosa",   marca: "FARM",  qtd: 1, preco_unit: 45.00, subtotal: 45.00 },
    { nome: "Calça Jeans Slim",     cor: "Azul",   marca: "LEVI'S", qtd: 1, preco_unit: 89.90, subtotal: 89.90 },
    { nome: "Cinto de Couro",       cor: "Marrom", marca: "AREZZO",  qtd: 2, preco_unit: 25.00, subtotal: 50.00 },
  ],
  forma_pagamento: "PIX",
  frete: 0,
  desconto: 10.00,
  total: 174.90,
}

export default function ReciboPreviewPage() {
  const [gerando, setGerando] = useState(false)
  const [pdfUrl, setPdfUrl]   = useState<string | null>(null)

  async function gerar() {
    setGerando(true)
    try {
      const blob = await gerarReciboPDF(EXEMPLO)
      const url  = URL.createObjectURL(blob)
      setPdfUrl(url)
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8"
      style={{ background: "#1a1a2e" }}>

      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-1">Preview do Recibo PDF</h1>
        <p className="text-sm text-gray-400">Dados de exemplo — exatamente como a cliente receberá</p>
      </div>

      <div className="flex gap-3">
        <button onClick={gerar} disabled={gerando}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white disabled:opacity-50"
          style={{ background: "#6366f1" }}>
          {gerando
            ? <><Loader2 size={16} className="animate-spin" /> Gerando...</>
            : <><Eye size={16} /> Visualizar Recibo</>}
        </button>

        {pdfUrl && (
          <a href={pdfUrl} download="recibo-exemplo.pdf"
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white"
            style={{ background: "#10b981" }}>
            <Download size={16} /> Baixar PDF
          </a>
        )}
      </div>

      {pdfUrl && (
        <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          <iframe
            src={pdfUrl}
            className="w-full"
            style={{ height: "80vh" }}
            title="Preview Recibo"
          />
        </div>
      )}
    </div>
  )
}
