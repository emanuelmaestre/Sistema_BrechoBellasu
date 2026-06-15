// ══════════════════════════════════════════════════════════════════
// Export Helpers — PDF e Excel profissionais para Brechó Bellasu
// ══════════════════════════════════════════════════════════════════

export const EMPRESA = "Brechó Bellasu"
export const SLOGAN  = "O Desapego é o Esporte da Felicidade!"

// Paleta corporativa — Charcoal + Dourado
const COR = {
  primaria:   [15,  23,  42] as [number, number, number],  // navy escuro
  secundaria: [30,  41,  59] as [number, number, number],  // navy médio
  accent:     [180, 130,  20] as [number, number, number],  // dourado
  accentCl:   [212, 170,  60] as [number, number, number],  // dourado claro
  headerTxt:  [255, 255, 255] as [number, number, number],
  totalBg:    [241, 245, 249] as [number, number, number],  // slate-100
  totalTxt:   [15,  23,  42] as [number, number, number],
  linhaAlt:   [248, 250, 252] as [number, number, number],  // slate-50
  borda:      [203, 213, 225] as [number, number, number],  // slate-300
  muted:      [100, 116, 139] as [number, number, number],  // slate-500
  verde:      [22,  163,  74] as [number, number, number],
  vermelho:   [220,  38,  38] as [number, number, number],
}

// Gera timestamp e nome de arquivo padronizado
export function nomeArquivo(relatorio: string, ext: "xlsx" | "pdf"): string {
  const now = new Date()
  const d = now.toISOString().slice(0, 10)
  const h = now.toTimeString().slice(0, 5).replace(":", "-")
  const slug = relatorio.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "")
  return `RELATORIO_${slug}_${d}_${h}.${ext}`
}

// Texto de período formatado
function labelPeriodo(de?: string, ate?: string): string {
  if (!de && !ate) return "Todos os períodos"
  const fmt = (s: string) => {
    const [y, m, d] = s.split("-")
    return `${d}/${m}/${y}`
  }
  if (de && ate && de !== ate) return `${fmt(de)} a ${fmt(ate)}`
  if (de) return `A partir de ${fmt(de)}`
  return "—"
}

// ─────────────────────────────────────────────────────────────────
// EXCEL PROFISSIONAL
// ─────────────────────────────────────────────────────────────────
export interface ExcelOpts {
  relatorio:   string
  headers:     string[]
  rows:        (string | number)[][]
  totais?:     (string | number)[]
  colTipos?:   ("texto" | "moeda" | "numero" | "data" | "pct")[]
  periodoStr?: string
  de?:         string
  ate?:        string
  orientation?: "portrait" | "landscape"
}

export async function exportExcelProfissional(opts: ExcelOpts): Promise<void> {
  const XLSX = await import("xlsx")
  const { relatorio, headers, rows, totais, de, ate } = opts

  const periodoStr = opts.periodoStr ?? labelPeriodo(de, ate)
  const geradoEm   = new Date().toLocaleString("pt-BR")

  // Monta AOA com metadados no topo
  const aoa: (string | number | null)[][] = [
    [EMPRESA],
    [SLOGAN],
    [`Relatório: ${relatorio}`],
    [`Período: ${periodoStr}`],
    [`Gerado em: ${geradoEm}`],
    [],
    headers,
    ...rows,
  ]

  if (totais) {
    aoa.push([])
    aoa.push(["TOTAL", ...totais.slice(1)])
  }

  if (!rows.length) {
    aoa.push([])
    aoa.push(["Nenhum registro encontrado para os filtros selecionados."])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Largura automática das colunas
  const colWidths: { wch: number }[] = headers.map((h, ci) => {
    const maxData = rows.reduce((mx, row) => {
      const v = row[ci]
      return Math.max(mx, String(v ?? "").length)
    }, h.length)
    return { wch: Math.max(12, Math.min(maxData + 2, 50)) }
  })
  ws["!cols"] = colWidths

  // Altura das linhas de metadados
  ws["!rows"] = [
    { hpt: 22 },
    { hpt: 14 },
    { hpt: 16 },
    { hpt: 14 },
    { hpt: 14 },
    { hpt: 8  },
    { hpt: 20 },
  ]

  // Freeze na linha do cabeçalho
  ws["!freeze"] = { xSplit: 0, ySplit: 7 }

  // Mescla células do topo
  const lastCol = Math.max(headers.length - 1, 0)
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: lastCol } },
  ]

  // Auto-filter no cabeçalho
  const endCol = XLSX.utils.encode_col(headers.length - 1)
  ws["!autofilter"] = { ref: `A7:${endCol}${7 + rows.length}` }

  const wb = XLSX.utils.book_new()
  const sheetName = relatorio.slice(0, 31)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // bookType explícito garante extensão e formato .xlsx corretos
  const filename = nomeArquivo(relatorio, "xlsx")
  XLSX.writeFile(wb, filename, { bookType: "xlsx", compression: true })
}

// ─────────────────────────────────────────────────────────────────
// PDF PROFISSIONAL
// ─────────────────────────────────────────────────────────────────
export interface PdfOpts {
  relatorio:    string
  headers:      string[]
  rows:         (string | number)[][]
  totais?:      (string | number)[]
  colAligns?:   ("left" | "center" | "right")[]
  colWidths?:   number[]
  periodoStr?:  string
  de?:          string
  ate?:         string
  orientation?: "portrait" | "landscape"
  resumo?:      { label: string; valor: string; destaque?: boolean }[]
}

export async function exportPdfProfissional(opts: PdfOpts): Promise<void> {
  const { default: jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")

  const { relatorio, headers, rows, totais, de, ate, resumo } = opts
  const periodoStr = opts.periodoStr ?? labelPeriodo(de, ate)
  const geradoEm   = new Date().toLocaleString("pt-BR")

  const orientation: "l" | "p" = opts.orientation === "portrait" ? "p"
    : opts.orientation === "landscape" ? "l"
    : headers.length > 5 ? "l" : "p"

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" })
  const PW = orientation === "l" ? 297 : 210
  const MARGIN = 14
  let yPos = MARGIN

  // ── CABEÇALHO ──
  // Faixa navy principal
  doc.setFillColor(...COR.primaria)
  doc.rect(0, 0, PW, 26, "F")

  // Faixa navy médio na parte inferior do header
  doc.setFillColor(...COR.secundaria)
  doc.rect(0, 20, PW, 6, "F")

  // Linha dourada de destaque abaixo do header
  doc.setFillColor(...COR.accent)
  doc.rect(0, 26, PW, 1.5, "F")

  // Barra lateral dourada à esquerda
  doc.setFillColor(...COR.accent)
  doc.rect(0, 0, 3.5, 26, "F")

  // Nome da empresa
  doc.setTextColor(...COR.headerTxt)
  doc.setFontSize(15)
  doc.setFont("helvetica", "bold")
  doc.text(EMPRESA, MARGIN + 2, 11)

  // Slogan
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(180, 195, 215)
  doc.text(SLOGAN, MARGIN + 2, 17.5)

  // Data/hora alinhada à direita
  doc.setFontSize(7)
  doc.setTextColor(...COR.accentCl)
  doc.text(`Emitido em ${geradoEm}`, PW - MARGIN, 22.5, { align: "right" })

  yPos = 33

  // ── BLOCO DE TÍTULO ──
  doc.setFillColor(...COR.totalBg)
  doc.roundedRect(MARGIN, yPos, PW - 2 * MARGIN, 14, 2, 2, "F")

  // Borda dourada lateral no título
  doc.setFillColor(...COR.accent)
  doc.roundedRect(MARGIN, yPos, 3, 14, 1, 1, "F")

  doc.setTextColor(...COR.primaria)
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text(relatorio.toUpperCase(), MARGIN + 7, yPos + 6.5)

  doc.setFontSize(7.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COR.muted)
  doc.text(`Período: ${periodoStr}`, PW - MARGIN - 4, yPos + 9.5, { align: "right" })

  yPos += 20

  // ── BLOCO DE RESUMO (KPIs) ──
  if (resumo?.length) {
    const gap  = 4
    const boxW = (PW - 2 * MARGIN - (resumo.length - 1) * gap) / resumo.length

    resumo.forEach((item, i) => {
      const x = MARGIN + i * (boxW + gap)

      if (item.destaque) {
        doc.setFillColor(...COR.primaria)
        doc.roundedRect(x, yPos, boxW, 18, 2, 2, "F")
        doc.setFillColor(...COR.accent)
        doc.rect(x, yPos, boxW, 1.5, "F")

        doc.setFontSize(6.5)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...COR.accentCl)
        doc.text(item.label.toUpperCase(), x + boxW / 2, yPos + 7.5, { align: "center" })

        doc.setFontSize(11)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...COR.headerTxt)
        doc.text(item.valor, x + boxW / 2, yPos + 14, { align: "center" })
      } else {
        doc.setFillColor(...COR.totalBg)
        doc.roundedRect(x, yPos, boxW, 18, 2, 2, "F")
        doc.setDrawColor(...COR.borda)
        doc.setLineWidth(0.3)
        doc.roundedRect(x, yPos, boxW, 18, 2, 2, "S")

        doc.setFontSize(6.5)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...COR.muted)
        doc.text(item.label.toUpperCase(), x + boxW / 2, yPos + 7.5, { align: "center" })

        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...COR.primaria)
        doc.text(item.valor, x + boxW / 2, yPos + 14, { align: "center" })
      }
    })
    yPos += 24
  }

  // ── TABELA ──
  if (!rows.length) {
    doc.setFillColor(...COR.totalBg)
    doc.roundedRect(MARGIN, yPos, PW - 2 * MARGIN, 22, 2, 2, "F")
    doc.setDrawColor(...COR.borda)
    doc.setLineWidth(0.3)
    doc.roundedRect(MARGIN, yPos, PW - 2 * MARGIN, 22, 2, 2, "S")

    doc.setFontSize(10)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(...COR.muted)
    doc.text(
      "Nenhum registro encontrado para os filtros selecionados.",
      PW / 2, yPos + 13, { align: "center" }
    )
    yPos += 28
  } else {
    const colStyles: Record<number, { halign: "left" | "center" | "right"; cellWidth?: number }> = {}
    headers.forEach((h, i) => {
      const align = opts.colAligns?.[i]
        ?? (h.includes("R$") || h.includes("Valor") || h.includes("Total") || h.includes("Ticket")
            ? "right"
            : h.includes("Qtd") || h === "#" || h.includes("Compras")
            ? "center"
            : "left")
      colStyles[i] = { halign: align }
      if (opts.colWidths?.[i]) colStyles[i].cellWidth = opts.colWidths[i]
    })

    const bodyWithTotals: (string | number)[][] = [...rows]
    if (totais) bodyWithTotals.push(totais)

    autoTable(doc, {
      head: [headers],
      body: bodyWithTotals.map((r) => r.map(String)),
      startY: yPos,
      margin: { left: MARGIN, right: MARGIN },
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 3.5, right: 5, bottom: 3.5, left: 5 },
        textColor: COR.primaria,
        lineColor: COR.borda,
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: COR.primaria,
        textColor: COR.headerTxt,
        fontStyle: "bold",
        fontSize: 8,
        cellPadding: { top: 4.5, right: 5, bottom: 4.5, left: 5 },
      },
      alternateRowStyles: {
        fillColor: COR.linhaAlt,
      },
      columnStyles: colStyles,
      didParseCell(data) {
        if (totais && data.row.index === bodyWithTotals.length - 1 && data.section === "body") {
          data.cell.styles.fillColor = COR.totalBg
          data.cell.styles.textColor = COR.primaria
          data.cell.styles.fontStyle = "bold"
          data.cell.styles.fontSize  = 9
          data.cell.styles.lineWidth = 0.5
          data.cell.styles.lineColor = COR.accent
        }
      },
      showHead: "everyPage",
      didDrawPage(data) {
        const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
        const currentPage = data.pageNumber

        const footerY = orientation === "l" ? 205 : 290

        // Linha separadora do rodapé
        doc.setDrawColor(...COR.borda)
        doc.setLineWidth(0.4)
        doc.line(MARGIN, footerY - 4, PW - MARGIN, footerY - 4)

        // Traço dourado curto no rodapé
        doc.setFillColor(...COR.accent)
        doc.rect(MARGIN, footerY - 4, 18, 0.8, "F")

        doc.setFontSize(7)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...COR.muted)
        doc.text(`${EMPRESA}  ·  ${SLOGAN}`, MARGIN, footerY)
        doc.text(
          `Página ${currentPage} de ${pageCount}  ·  ${geradoEm}`,
          PW - MARGIN, footerY, { align: "right" }
        )
      },
    })
  }

  doc.save(nomeArquivo(relatorio, "pdf"))
}
