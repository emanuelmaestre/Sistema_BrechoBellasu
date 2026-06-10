// ══════════════════════════════════════════════════════════
// Gerador de Recibo PDF — roda no navegador (jsPDF)
// Estilo: Brechó Bellasu — dourado/marrom/creme com logo
// Colunas separadas: Cor e Tamanho. Layout caprichado UI/UX.
// ══════════════════════════════════════════════════════════

import jsPDF from "jspdf"

export interface ReciboItem {
  nome: string
  cor?: string | null
  marca?: string | null
  qtd: number
  preco_unit: number
  subtotal: number
}

export interface ReciboData {
  numero: number | string
  tipo: "Venda" | "Troca" | "Devolução"
  data: string
  cliente_nome: string
  cliente_celular: string
  itens: ReciboItem[]
  forma_pagamento: string
  frete?: number
  desconto?: number
  total: number
}

// ── Paleta (igual ao HTML) ───────────────────────────────
const GOLD   = [201, 168, 76]  as [number, number, number]
const GOLD_L = [232, 212, 154] as [number, number, number]
const GOLD_D = [155, 122,  47] as [number, number, number]
const BROWN  = [ 59,  31,  14] as [number, number, number]
const BR2    = [107,  66,  38] as [number, number, number]
const CREAM  = [247, 242, 232] as [number, number, number]
const WHITE  = [255, 255, 255] as [number, number, number]
const LIGHT  = [237, 229, 213] as [number, number, number]
const TEXT   = [ 59,  31,  14] as [number, number, number]
const MUTED  = [150, 120,  85] as [number, number, number]

function fmtBRL(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`
}

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch("/logo-bellasu-pdf.jpg")
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Barra dourada em degradê (3 faixas)
function goldBar(doc: jsPDF, y: number, w: number) {
  doc.setFillColor(...GOLD_D); doc.rect(0, y, w, 1.5, "F")
  doc.setFillColor(...GOLD);   doc.rect(0, y + 1.5, w, 1.5, "F")
  doc.setFillColor(...GOLD_L); doc.rect(0, y + 3, w, 1, "F")
}

function divider(doc: jsPDF, y: number, xa: number, xb: number) {
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.4)
  doc.line(xa, y, xb, y)
}

// Título de seção com tracinho dourado ao lado
function sectionTitle(doc: jsPDF, label: string, x: number, y: number, w: number) {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(...BROWN)           // marrom escuro — bem legível
  doc.text(label.toUpperCase(), x, y, { charSpace: 1.8 })
  const tw = doc.getTextWidth(label.toUpperCase()) + 6
  doc.setDrawColor(...GOLD)            // linha dourada mais viva
  doc.setLineWidth(0.35)
  doc.line(x + tw, y - 1.5, x + w, y - 1.5)
}

export async function gerarReciboPDF(data: ReciboData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
  const W = doc.internal.pageSize.getWidth()  // 210
  const M = 15
  const CW = W - M * 2
  let y = 0

  const logo = await loadLogo()

  // ══ TOPO ══
  goldBar(doc, 0, W)
  y = 4

  // ── HEADER (fundo creme) — posições explícitas p/ não sobrepor ──
  const headerH = logo ? 62 : 46
  doc.setFillColor(...CREAM)
  doc.rect(0, y, W, headerH, "F")

  let hy = y // y = 4 (logo após a barra dourada)

  // Logo centralizada
  if (logo) {
    const ls = 24
    doc.addImage(logo, "JPEG", (W - ls) / 2, hy + 6, ls, ls)
    hy = hy + 6 + ls + 8   // base da logo (34) + folga (8) → título em ~42
  } else {
    hy += 12
  }

  // Título serif
  doc.setFont("times", "bold")
  doc.setFontSize(21)
  doc.setTextColor(...BROWN)
  doc.text("BRECHÓ BELLASU", W / 2, hy, { align: "center", charSpace: 1.5 })
  hy += 6

  // Slogan
  doc.setFont("times", "italic")
  doc.setFontSize(9.5)
  doc.setTextColor(...GOLD_D)
  doc.text("O Desapego é o Esporte da Felicidade!", W / 2, hy, { align: "center" })
  hy += 5.5

  // Divisor
  divider(doc, hy, M + 34, W - M - 34)
  hy += 6.5

  // Meta: Nº | Data | Tipo
  const mc = [W / 6 + 6, W / 2, (5 * W) / 6 - 6]
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.5)
  doc.setTextColor(...GOLD_D)
  doc.text("Nº RECIBO", mc[0], hy, { align: "center", charSpace: 0.6 })
  doc.text("DATA DA COMPRA", mc[1], hy, { align: "center", charSpace: 0.6 })
  doc.text("TIPO",      mc[2], hy, { align: "center", charSpace: 0.6 })
  hy += 4.5
  doc.setFont("times", "normal")
  doc.setFontSize(11)
  doc.setTextColor(...BROWN)
  doc.text(String(data.numero).padStart(3, "0"), mc[0], hy, { align: "center" })
  doc.text(data.data, mc[1], hy, { align: "center" })
  doc.text(data.tipo, mc[2], hy, { align: "center" })

  // Conteúdo começa abaixo do header com folga
  y = 4 + headerH + 10

  // ══ CLIENTE ══
  sectionTitle(doc, "Cliente", M, y, CW)
  y += 7
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9.5)
  doc.setTextColor(...MUTED)
  doc.text("Nome", M, y)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10.5)
  doc.setTextColor(...TEXT)
  doc.text(data.cliente_nome.toUpperCase(), M, y + 5)
  if (data.cliente_celular) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9.5)
    doc.setTextColor(...MUTED)
    doc.text("WhatsApp", W / 2 + 6, y)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10.5)
    doc.setTextColor(...TEXT)
    doc.text(data.cliente_celular, W / 2 + 6, y + 5)
  }
  y += 11

  // LGPD box
  doc.setFillColor(255, 250, 239)
  doc.setDrawColor(...GOLD_L)
  doc.setLineWidth(0.4)
  doc.roundedRect(M, y, CW, 10, 1.5, 1.5, "FD")
  doc.setFillColor(...GOLD)
  doc.rect(M, y + 1, 1.3, 8, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.3)
  doc.setTextColor(...GOLD_D)
  doc.text("LGPD – LEI 13.709/2018", M + 4, y + 4)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...BR2)
  doc.text("Nome e telefone coletados exclusivamente para identificação desta transação. Não compartilhados com terceiros.", M + 4, y + 7.5)
  y += 16

  // ══ ITENS ══
  sectionTitle(doc, "Itens", M, y, CW)
  y += 6

  // Posições das colunas (sem COR — modelo HTML oficial: Descrição | Tam. | Qtd. | Preço Unit. | Subtotal)
  const cDesc = M + 3
  const cMarca = M + 108
  const cQtd  = M + 130
  const cUnit = M + 153
  const cSub  = W - M - 3

  // Cabeçalho (marrom, cantos arredondados no topo)
  doc.setFillColor(...BROWN)
  doc.roundedRect(M, y, CW, 7.5, 1.5, 1.5, "F")
  doc.rect(M, y + 3.75, CW, 3.75, "F") // tampa a parte de baixo dos cantos
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...GOLD_L)
  doc.text("DESCRIÇÃO",   cDesc, y + 5, { charSpace: 0.3 })
  doc.text("MARCA",       cMarca,  y + 5, { align: "center", charSpace: 0.3 })
  doc.text("QTD",         cQtd,  y + 5, { align: "center", charSpace: 0.3 })
  doc.text("PREÇO UNIT.", cUnit, y + 5, { align: "center", charSpace: 0.3 })
  doc.text("SUBTOTAL",    cSub,  y + 5, { align: "right", charSpace: 0.3 })
  y += 7.5

  const tableTop = y
  const rowH = 7.5
  data.itens.forEach((item, i) => {
    doc.setFillColor(...(i % 2 === 0 ? WHITE : CREAM))
    doc.rect(M, y, CW, rowH, "F")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(...TEXT)
    const nome = doc.splitTextToSize(item.nome, 90)[0]
    doc.text(nome, cDesc, y + 5)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...BR2)
    doc.text(item.marca || "—", cMarca, y + 5, { align: "center" })

    doc.setTextColor(...TEXT)
    doc.text(String(item.qtd), cQtd, y + 5, { align: "center" })
    doc.setTextColor(...MUTED)
    doc.text(fmtBRL(item.preco_unit), cUnit, y + 5, { align: "center" })

    doc.setFont("helvetica", "bold")
    doc.setTextColor(...BROWN)
    doc.text(fmtBRL(item.subtotal), cSub, y + 5, { align: "right" })
    y += rowH
  })

  // Borda externa + linhas verticais suaves
  doc.setDrawColor(...LIGHT)
  doc.setLineWidth(0.3)
  doc.rect(M, tableTop, CW, data.itens.length * rowH, "S")
  y += 9

  // ══ PAGAMENTO + TOTAL ══
  const colR = W / 2 + 8
  sectionTitle(doc, "Pagamento", M, y, CW / 2 - 12)
  sectionTitle(doc, "Resumo", colR, y, W - M - colR)
  const blocoTop = y + 6
  y += 6

  // Chips de pagamento (2x2)
  const formas = ["PIX", "Dinheiro", "Crédito", "Débito"]
  const chipW = (CW / 2 - 16) / 2
  const chipH = 9
  formas.forEach((f, i) => {
    const cx = M + (i % 2) * (chipW + 3)
    const cy = blocoTop + Math.floor(i / 2) * (chipH + 3)
    const sel = (data.forma_pagamento ?? "").toLowerCase().includes(f.toLowerCase())
    const [fr, fg, fb] = sel ? BROWN : WHITE
    doc.setFillColor(fr, fg, fb)
    doc.setDrawColor(...(sel ? BROWN : GOLD_L))
    doc.setLineWidth(0.4)
    doc.roundedRect(cx, cy, chipW, chipH, 2, 2, "FD")
    doc.setFont("helvetica", sel ? "bold" : "normal")
    doc.setFontSize(8)
    const [tr, tg, tb] = sel ? GOLD_L : MUTED
    doc.setTextColor(tr, tg, tb)
    doc.text(f, cx + chipW / 2, cy + 5.7, { align: "center" })
  })

  // Resumo financeiro (direita)
  let ty = blocoTop + 2
  const subtotal = data.itens.reduce((s, it) => s + it.subtotal, 0)
  const linha = (label: string, valor: string) => {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(label, colR, ty)
    doc.setTextColor(...TEXT)
    doc.text(valor, W - M - 3, ty, { align: "right" })
    ty += 5.5
  }
  linha("Subtotal", fmtBRL(subtotal))
  if ((data.frete ?? 0) > 0)    linha("Frete", fmtBRL(data.frete ?? 0))
  if ((data.desconto ?? 0) > 0) linha("Desconto", `– ${fmtBRL(data.desconto ?? 0)}`)

  // Caixa TOTAL destacada
  ty += 1.5
  const totalBoxH = 11
  doc.setFillColor(...BROWN)
  doc.roundedRect(colR - 4, ty - 4, W - M - colR + 7, totalBoxH, 2, 2, "F")
  doc.setFont("times", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...GOLD_L)
  doc.text("TOTAL", colR, ty + 3)
  doc.setFontSize(14)
  doc.setTextColor(...WHITE)
  doc.text(fmtBRL(data.total), W - M - 3, ty + 3.2, { align: "right" })

  y = Math.max(blocoTop + 2 * (chipH + 3) + 4, ty + totalBoxH)

  // ══ RODAPÉ ══
  // ══ RODAPÉ ══
  const footerY = Math.max(y + 14, 248)

  // Linha separadora dourada suave
  doc.setDrawColor(...GOLD_L)
  doc.setLineWidth(0.3)
  doc.line(M, footerY, W - M, footerY)

  // Fundo creme + barra dourada
  const footerBg = footerY + 1
  doc.setFillColor(252, 249, 242)
  doc.rect(0, footerBg, W, 44, "F")
  doc.setFillColor(...GOLD)
  doc.rect(0, footerBg, W, 2.5, "F")

  // ── "Obrigada pela sua compra!" centrado ──
  const agradY = footerBg + 11
  doc.setFont("times", "bolditalic")
  doc.setFontSize(11.5)
  doc.setTextColor(...GOLD_D)
  doc.text("Obrigada pela sua compra!", W / 2, agradY, { align: "center" })

  // ── Dois blocos de contato simetricamente centrados ──
  // Bloco Esquerdo (WhatsApp) centrado em W/2 - 28, Bloco Direito (Instagram) em W/2 + 28
  const ftColL = W / 2 - 28   // centro do bloco WhatsApp
  const ftColR = W / 2 + 28   // centro do bloco Instagram
  const lblY  = agradY + 9  // linha do label
  const valY  = lblY + 5    // linha do valor (link)
  const lineY = valY + 2.5  // linha do sublinhado

  // Separador central ·
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...GOLD_L)
  doc.text("·", W / 2, valY, { align: "center" })

  // Label WhatsApp
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text("W h a t s A p p", ftColL, lblY, { align: "center" })

  // Valor WhatsApp (link clicável)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(...GOLD_D)
  const wppLabel = "(16) 99455-6296"
  const wppW = doc.getTextWidth(wppLabel)
  const wppX = ftColL - wppW / 2
  doc.textWithLink(wppLabel, wppX, valY, { url: "https://wa.me/5516994556296" })
  // Sublinhado tracejado
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.3)
  doc.setLineDashPattern([0.8, 0.8], 0)
  doc.line(wppX, lineY, wppX + wppW, lineY)
  doc.setLineDashPattern([], 0)

  // Label Instagram
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text("I n s t a g r a m", ftColR, lblY, { align: "center" })

  // Valor Instagram (link clicável)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(...GOLD_D)
  const igLabel = "@brecho.bellasu"
  const igW  = doc.getTextWidth(igLabel)
  const igX  = ftColR - igW / 2
  doc.textWithLink(igLabel, igX, valY, { url: "https://www.instagram.com/brecho.bellasu/" })
  // Sublinhado tracejado
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.3)
  doc.setLineDashPattern([0.8, 0.8], 0)
  doc.line(igX, lineY, igX + igW, lineY)
  doc.setLineDashPattern([], 0)

  // ── Nota final ──
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(...GOLD_D)
  doc.text("TROCAS ACEITAS EM ATÉ 7 DIAS   ·   GUARDE ESTE RECIBO", W / 2, valY + 11, { align: "center", charSpace: 0.8 })

  return doc.output("blob")
}
