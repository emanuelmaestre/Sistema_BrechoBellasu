// ══════════════════════════════════════════════════════════════════
// Exportação da etiqueta de sacola em PDF e PNG.
//
// Existe porque a impressora vai desconectar em algum momento, e não
// pode ser aí que o lote se perde: o arquivo salvo imprime idêntico
// depois, de outra máquina, ou vai pro celular via Bluetooth.
// ══════════════════════════════════════════════════════════════════

import { ETIQUETA_MM } from "./etiqueta-sacola"

/** Resolução da BY-480BT. A 203 dpi são exatamente 8 pontos por mm. */
export const DPI_IMPRESSORA = 203

/** CSS assume 96 dpi — é a referência para converter mm em pixel na tela. */
const DPI_CSS = 96

/**
 * 800 × 1176 px: um pixel do arquivo vira um ponto da impressora, sem
 * reamostragem. Se o tamanho não for exato, a impressora interpola e o
 * texto de 2,5 mm embola.
 */
export const PNG_PX = {
  largura: Math.round((ETIQUETA_MM.largura / 25.4) * DPI_IMPRESSORA), // 800
  altura: Math.round((ETIQUETA_MM.altura / 25.4) * DPI_IMPRESSORA), // 1176
} as const

const ESCALA = DPI_IMPRESSORA / DPI_CSS // ≈ 2,1146

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
    return await html2canvas(clone, {
      scale: ESCALA,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
    })
  } finally {
    document.body.removeChild(palco)
  }
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
