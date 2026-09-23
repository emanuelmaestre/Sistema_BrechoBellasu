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
 * Usa `html-to-image`, que entrega o HTML ao próprio navegador (via SVG)
 * para desenhar. O `html2canvas` refazia o layout do texto por conta
 * própria e deslocava tudo para baixo: o número branco da sacola saía
 * do quadrado preto e sumia, o TOTAL encostava na régua e o remetente
 * era cortado na borda.
 *
 * O elemento é clonado num contêiner fora da vista em escala 1:1 — se
 * rasterizássemos o que está na grade, a redução visual dos cartões
 * entraria no arquivo.
 */
async function rasterizar(etiqueta: HTMLElement): Promise<HTMLCanvasElement> {
  const { toCanvas } = await import("html-to-image")
  await aguardarFontes()

  const palco = document.createElement("div")
  palco.style.cssText = "position:fixed;left:-10000px;top:0;background:#fff"
  const clone = etiqueta.cloneNode(true) as HTMLElement
  clone.style.transform = "none"
  clone.style.margin = "0"
  palco.appendChild(clone)
  document.body.appendChild(palco)

  try {
    const bruto = await toCanvas(clone, {
      pixelRatio: ESCALA,
      backgroundColor: "#ffffff",
      // O tamanho físico vem do CSS em mm; nada de redimensionar pelo viewport.
      width: clone.offsetWidth,
      height: clone.offsetHeight,
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

/**
 * Etiqueta em 1 bit por ponto, 800 × 1176, pronta para a impressora.
 * `preto[y * largura + x]` é true onde a cabeça deve queimar. O limiar
 * de 160 mantém o texto fino de 2,5 mm sem engrossar.
 */
export async function etiquetaParaPontos(
  etiqueta: HTMLElement,
): Promise<{ largura: number; altura: number; preto: Uint8Array }> {
  const canvas = await rasterizar(etiqueta)
  const { width, height } = canvas
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Não foi possível ler a etiqueta renderizada.")
  const rgba = ctx.getImageData(0, 0, width, height).data
  const preto = new Uint8Array(width * height)
  for (let i = 0; i < preto.length; i++) {
    const luz = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000
    preto[i] = luz < 160 ? 1 : 0
  }
  return { largura: width, altura: height, preto }
}

// ─── Metadado de resolução física ─────────────────────────────────
//
// O PNG do canvas sai sem informar quantos pontos por milímetro tem.
// Um app que importa a etiqueta e a redimensiona pela DPI, em vez de
// deixar digitar o tamanho em mm, imprimiria do tamanho errado sem essa
// informação. O chunk `pHYs` do PNG resolve isso, e nenhuma biblioteca
// nova precisa entrar no projeto para escrever 21 bytes.

/** CRC32 padrão do PNG (zlib) — usado no chunk que a gente insere. */
function crc32(bytes: Uint8Array): number {
  let crc = ~0
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ~crc >>> 0
}

const PONTOS_POR_METRO = PONTOS_POR_MM * 1000

/**
 * Insere o chunk `pHYs` logo depois do `IHDR` — posição fixa, porque o
 * PNG exige que `IHDR` seja sempre o primeiro chunk e ele tem tamanho
 * fixo (13 bytes de dados). Declara 8 pontos/mm nos dois eixos: a
 * mesma densidade da BY-480BT, então um app que lê o metadado calcula
 * o tamanho físico certo sem precisar perguntar.
 */
function comResolucaoFisica(png: Uint8Array): Uint8Array<ArrayBuffer> {
  const FIM_DO_IHDR = 33 // 8 (assinatura) + 4+4+13+4 (IHDR completo)

  const tipo = new TextEncoder().encode("pHYs")
  const dados = new Uint8Array(9)
  const vista = new DataView(dados.buffer)
  vista.setUint32(0, PONTOS_POR_METRO) // pixels por metro, eixo X
  vista.setUint32(4, PONTOS_POR_METRO) // pixels por metro, eixo Y
  dados[8] = 1 // unidade: metro

  const chunk = new Uint8Array(4 + 4 + 9 + 4)
  const vistaChunk = new DataView(chunk.buffer)
  vistaChunk.setUint32(0, 9) // tamanho dos dados
  chunk.set(tipo, 4)
  chunk.set(dados, 8)
  vistaChunk.setUint32(17, crc32(chunk.slice(4, 17)))

  const saida: Uint8Array<ArrayBuffer> = new Uint8Array(png.length + chunk.length)
  saida.set(png.slice(0, FIM_DO_IHDR))
  saida.set(chunk, FIM_DO_IHDR)
  saida.set(png.slice(FIM_DO_IHDR), FIM_DO_IHDR + chunk.length)
  return saida
}

/** Mesmo PNG, com o chunk `pHYs` de 203 dpi embutido. */
export async function pngComResolucaoFisica(blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return new Blob([comResolucaoFisica(bytes)], { type: "image/png" })
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
  const bruto = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!bruto) throw new Error("Não foi possível gerar o PNG da etiqueta.")
  baixarBlob(await pngComResolucaoFisica(bruto), nomeArquivo)
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
    // Compressão sem perda: sem ela o jsPDF grava a imagem crua, e um lote
    // de 8 etiquetas chegava a 21 MB — pesado para importar no celular.
    doc.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0, 0,
      ETIQUETA_MM.largura, ETIQUETA_MM.altura,
      undefined,
      "FAST",
    )
  }

  baixarBlob(doc.output("blob"), nomeArquivo)
}
