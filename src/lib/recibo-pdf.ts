// ══════════════════════════════════════════════════════════
// Gerador de Recibo PDF — roda no navegador (jsPDF)
// Estilo: Brechó Bellasu — dourado/marrom/creme
// ══════════════════════════════════════════════════════════

import jsPDF from "jspdf"

export interface ReciboItem {
  nome: string
  cor_tam?: string | null
  qtd: number
  preco_unit: number
  subtotal: number
}

export interface ReciboData {
  numero: number | string
  tipo: "Venda" | "Troca" | "Devolução"
  data: string           // ex: "01/06/2026"
  cliente_nome: string
  cliente_celular: string
  itens: ReciboItem[]
  forma_pagamento: string
  frete?: number
  desconto?: number
  total: number
}

// ── Cores ────────────────────────────────────────────────
const GOLD   = [201, 168, 76]  as [number, number, number]
const GOLD_D = [155, 122,  47] as [number, number, number]
const BROWN  = [ 59,  31,  14] as [number, number, number]
const CREAM  = [247, 242, 232] as [number, number, number]
const WHITE  = [255, 255, 255] as [number, number, number]
const LIGHT  = [237, 229, 213] as [number, number, number]
const TEXT   = [ 59,  31,  14] as [number, number, number]
const MUTED  = [120,  90,  60] as [number, number, number]

function rgb(c: [number, number, number]) {
  return { r: c[0], g: c[1], b: c[2] }
}

function fmtBRL(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`
}

// Linha dourada gradiente (simulada com retângulo sólido)
function goldBar(doc: jsPDF, y: number, w: number) {
  doc.setFillColor(...GOLD)
  doc.rect(0, y, w, 4, "F")
}

// Linha separadora suave
function divider(doc: jsPDF, y: number, w: number) {
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.3)
  doc.line(14, y, w - 14, y)
}

export async function gerarReciboPDF(data: ReciboData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
  const W = doc.internal.pageSize.getWidth()
  let y = 0

  // ── Barra dourada topo ───────────────────────────────
  goldBar(doc, 0, W)
  y = 6

  // ── Header — fundo creme ─────────────────────────────
  doc.setFillColor(...CREAM)
  doc.rect(0, y, W, 42, "F")

  // Título
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.setTextColor(...BROWN)
  doc.text("BRECHÓ BELLASU", W / 2, y + 12, { align: "center" })

  doc.setFont("helvetica", "italic")
  doc.setFontSize(9)
  doc.setTextColor(...GOLD_D)
  doc.text("Moda circular com estilo e propósito", W / 2, y + 18, { align: "center" })

  divider(doc, y + 22, W)

  // Meta: Nº | Data | Tipo
  const metaY = y + 30
  const cols = [W / 6, W / 2, (5 * W) / 6]

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...GOLD_D)
  doc.text("Nº RECIBO", cols[0], metaY - 4, { align: "center" })
  doc.text("DATA", cols[1], metaY - 4, { align: "center" })
  doc.text("TIPO", cols[2], metaY - 4, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.setTextColor(...BROWN)
  doc.text(String(data.numero).padStart(3, "0"), cols[0], metaY + 2, { align: "center" })
  doc.text(data.data, cols[1], metaY + 2, { align: "center" })
  doc.text(data.tipo, cols[2], metaY + 2, { align: "center" })

  y += 48

  // ── Barra dourada separadora ─────────────────────────
  goldBar(doc, y, W)
  y += 6

  // ── Seção: Cliente ───────────────────────────────────
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...GOLD_D)
  doc.text("CLIENTE", 14, y + 4)
  divider(doc, y + 5, W)
  y += 9

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...TEXT)
  doc.text(`Nome: ${data.cliente_nome}`, 14, y + 5)
  doc.text(`WhatsApp: ${data.cliente_celular}`, 14, y + 11)
  y += 18

  // LGPD
  doc.setFillColor(255, 250, 239)
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.5)
  doc.rect(14, y, W - 28, 10, "FD")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.5)
  doc.setTextColor(...GOLD_D)
  doc.text("LGPD – Lei 13.709/2018:", 17, y + 4)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...MUTED)
  doc.text("Nome e telefone coletados exclusivamente para identificação desta transação. Não compartilhados com terceiros.", 17, y + 8)
  y += 16

  // ── Seção: Itens ─────────────────────────────────────
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...GOLD_D)
  doc.text("ITENS", 14, y + 4)
  divider(doc, y + 5, W)
  y += 9

  // Cabeçalho tabela
  doc.setFillColor(...BROWN)
  doc.rect(14, y, W - 28, 7, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(...WHITE)
  doc.text("DESCRIÇÃO", 16, y + 4.5)
  doc.text("COR/TAM", 100, y + 4.5, { align: "center" })
  doc.text("QTD", 130, y + 4.5, { align: "center" })
  doc.text("UNIT.", 155, y + 4.5, { align: "center" })
  doc.text("SUBTOTAL", W - 16, y + 4.5, { align: "right" })
  y += 7

  // Linhas dos itens
  data.itens.forEach((item, i) => {
    const bg = i % 2 === 0 ? WHITE : CREAM
    doc.setFillColor(...bg)
    doc.rect(14, y, W - 28, 7, "F")

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...TEXT)

    const nomeMax = doc.splitTextToSize(item.nome, 78)
    doc.text(nomeMax[0], 16, y + 4.5)
    doc.text(item.cor_tam ?? "—", 100, y + 4.5, { align: "center" })
    doc.text(String(item.qtd), 130, y + 4.5, { align: "center" })
    doc.text(fmtBRL(item.preco_unit), 155, y + 4.5, { align: "center" })

    doc.setFont("helvetica", "bold")
    doc.text(fmtBRL(item.subtotal), W - 16, y + 4.5, { align: "right" })
    y += 7
  })

  // Borda da tabela
  doc.setDrawColor(...LIGHT)
  doc.setLineWidth(0.3)
  doc.rect(14, y - (data.itens.length * 7) - 7, W - 28, data.itens.length * 7 + 7, "S")
  y += 4

  // ── Seção: Pagamento + Total ──────────────────────────
  const colL = 14
  const colR = W / 2 + 4
  const secW = W / 2 - 18

  // Títulos
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...GOLD_D)
  doc.text("PAGAMENTO", colL, y + 4)
  doc.text("TOTAL", colR, y + 4)
  divider(doc, y + 5, W / 2 - 4)
  y += 9

  // Forma de pagamento
  const formas = ["PIX", "Dinheiro", "Crédito", "Débito"]
  let px = colL
  formas.forEach(f => {
    const sel = data.forma_pagamento?.toLowerCase() === f.toLowerCase()
    doc.setFillColor(sel ? ...BROWN : ...WHITE)
    doc.setDrawColor(...GOLD_D)
    doc.setLineWidth(0.4)
    doc.roundedRect(px, y, secW / 4 - 2, 8, 1, 1, sel ? "FD" : "D")
    doc.setFont("helvetica", sel ? "bold" : "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(sel ? ...WHITE : ...MUTED)
    doc.text(f, px + (secW / 4 - 2) / 2, y + 5, { align: "center" })
    px += secW / 4
  })

  // Totais
  const totalY = y
  const addLinha = (label: string, valor: string, bold = false, color: [number,number,number] = TEXT) => {
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setFontSize(bold ? 10 : 8.5)
    doc.setTextColor(...color)
    doc.text(label, colR, totalY + (addLinha as unknown as { _i: number })._i * 7)
    doc.text(valor, W - 16, totalY + (addLinha as unknown as { _i: number })._i * 7, { align: "right" });
    (addLinha as unknown as { _i: number })._i++
  }
  ;(addLinha as unknown as { _i: number })._i = 0

  const subtotal = data.itens.reduce((s, it) => s + it.subtotal, 0)
  addLinha("Subtotal", fmtBRL(subtotal))
  if ((data.frete ?? 0) > 0) addLinha("Frete", fmtBRL(data.frete ?? 0))
  if ((data.desconto ?? 0) > 0) addLinha("Desconto", `– ${fmtBRL(data.desconto ?? 0)}`)

  // Linha total
  const totalLineY = totalY + (addLinha as unknown as { _i: number })._i * 7
  doc.setFillColor(...CREAM)
  doc.rect(colR - 2, totalLineY - 5, W - colR - 12, 9, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...BROWN)
  doc.text("TOTAL", colR, totalLineY + 1)
  doc.setTextColor(...GOLD_D)
  doc.text(fmtBRL(data.total), W - 16, totalLineY + 1, { align: "right" })

  y = Math.max(y + 28, totalLineY + 14)

  // ── Rodapé ───────────────────────────────────────────
  goldBar(doc, y, W)
  y += 5

  doc.setFont("helvetica", "italic")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text("Trocas aceitas em até 7 dias  ·  Guarde este recibo", W / 2, y + 5, { align: "center" })
  doc.text("Obrigada pela preferência! 💛", W / 2, y + 11, { align: "center" })

  return doc.output("blob")
}
