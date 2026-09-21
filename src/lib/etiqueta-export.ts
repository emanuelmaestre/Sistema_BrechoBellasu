// ══════════════════════════════════════════════════════════════════
// Exportação da etiqueta de sacola em PDF e PNG.
//
// Existe porque a impressora vai desconectar em algum momento, e não
// pode ser aí que o lote se perde: o arquivo salvo imprime idêntico
// depois, de outra máquina, ou vai pro celular via Bluetooth.
// ══════════════════════════════════════════════════════════════════

import { ETIQUETA_MM } from "./etiqueta-sacola"

/**
 * Densidade real da cabeça térmica: **8 pontos por milímetro**.
 *
 * A caixa anuncia "203 dpi", que é 8 pt/mm arredondado (8 × 25,4 = 203,2).
 * Calcular por 203 cravado erra por fração e o arquivo sai 799 × 1175 —
 * um pixel a menos em cada eixo já obriga a impressora a reamostrar, que
 * é justamente o que não pode acontecer com texto de 2,5 mm.
 */
export const PONTOS_POR_MM = 8

/** dpi nominal correspondente, para exibir na tela. */
export const DPI_IMPRESSORA = Math.round(PONTOS_POR_MM * 25.4) // 203

/** CSS assume 96 dpi — é a referência para converter mm em pixel na tela. */
const DPI_CSS = 96

/**
 * 800 × 1176 px: um pixel do arquivo vira um ponto da impressora, sem
 * reamostragem.
 */
export const PNG_PX = {
  largura: ETIQUETA_MM.largura * PONTOS_POR_MM, // 800
  altura: ETIQUETA_MM.altura * PONTOS_POR_MM, // 1176
} as const

/** 1 mm na tela tem 96/25,4 px; na impressora tem 8 pontos. */
const ESCALA = (PONTOS_POR_MM * 25.4) / DPI_CSS // ≈ 2,1167

/** Espera as fontes do documento antes de rasterizar. */
async function aguardarFontes(): Promise<void> {
  try {
    await document.fonts?.ready
  } catch {
    /* navegador sem FontFaceSet — segue com a fonte que já estiver aplicada */
  }
}

/**
 * Rasteriza uma etiqueta já renderizada na tela.
 *
 * O elemento é clonado num contêiner fora da vista em escala 1:1 — se
 * rasterizássemos o que está na grade, a redução visual dos cartões
 * entraria no arquivo.
 */
async function rasterizar(etiqueta: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas")
  await aguardarFontes()

  const palco = document.createElement("div")
  palco.style.cssText = "position:fixed;left:-10000px;top:0;background:#fff"
  const clone = etiqueta.cloneNode(true) as HTMLElement
  clone.style.transform = "none"
  clone.style.margin = "0"
  palco.appendChild(clone)
  document.body.appendChild(palco)

  try {
    const bruto = await html2canvas(clone, {
      scale: ESCALA,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
    })
    return normalizar(bruto)
  } finally {
    document.body.removeChild(palco)
  }
}

/**
 * Força o canvas para exatamente 800 × 1176.
 *
 * O navegador arredonda 100 mm para 377,9375 px em vez dos 377,953 px
 * exatos, e o canvas sai com 799,97 — que vira 799 ou 800 dependendo de
 * como a biblioteca arredonda. Fração de pixel aqui é reamostragem na
 * impressora, então o tamanho final é fixado à mão.
 */
function normalizar(bruto: HTMLCanvasElement): HTMLCanvasElement {
  if (bruto.width === PNG_PX.largura && bruto.height === PNG_PX.altura) return bruto

  const exato = document.createElement("canvas")
  exato.width = PNG_PX.largura
  exato.height = PNG_PX.altura
  const ctx = exato.getContext("2d")
  if (!ctx) return bruto
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, exato.width, exato.height)
  ctx.drawImage(bruto, 0, 0, exato.width, exato.height)
  return exato
}

function baixarBlob(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Revoga depois do clique para não cancelar o download em andamento.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Baixa uma etiqueta como PNG na resolução nativa da impressora. */
export async function baixarEtiquetaPNG(etiqueta: HTMLElement, nomeArquivo: string): Promise<void> {
  const canvas = await rasterizar(etiqueta)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("Não foi possível gerar o PNG da etiqueta.")
  baixarBlob(blob, nomeArquivo)
}

/**
 * Baixa etiquetas em PDF, uma por página de 100 × 147 mm.
 * Uma etiqueta só gera um PDF de uma página; o lote inteiro gera todas.
 */
export async function baixarEtiquetasPDF(
  etiquetas: HTMLElement[],
  nomeArquivo: string,
): Promise<void> {
  if (etiquetas.length === 0) throw new Error("Nenhuma etiqueta para exportar.")

  const { default: jsPDF } = await import("jspdf")
  const doc = new jsPDF({
    unit: "mm",
    format: [ETIQUETA_MM.largura, ETIQUETA_MM.altura],
    orientation: "portrait",
  })

  for (let i = 0; i < etiquetas.length; i++) {
    const canvas = await rasterizar(etiquetas[i])
    if (i > 0) doc.addPage([ETIQUETA_MM.largura, ETIQUETA_MM.altura], "portrait")
    // PNG, não JPEG: a etiqueta é preto no branco, e o JPEG suja as
    // bordas das letras pequenas com artefato de compressão.
    doc.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0, 0,
      ETIQUETA_MM.largura, ETIQUETA_MM.altura,
    )
  }

  baixarBlob(doc.output("blob"), nomeArquivo)
}
