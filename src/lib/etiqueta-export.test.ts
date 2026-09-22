import { describe, expect, it } from "vitest"
import { DPI_IMPRESSORA, pngComResolucaoFisica, PNG_PX, PONTOS_POR_MM } from "./etiqueta-export"
import { ETIQUETA_MM } from "./etiqueta-sacola"

describe("resolução do arquivo exportado", () => {
  it("bate exatamente com a grade de pontos da impressora", () => {
    // Um pixel do PNG = um ponto da cabeça térmica. Qualquer sobra faz a
    // impressora reamostrar e embolar o texto de 2,5 mm.
    expect(PNG_PX).toEqual({ largura: 800, altura: 1176 })
  })
  it("não usa 203 dpi cravado, que erra por fração", () => {
    // O erro que isso previne: Math.round(100/25.4*203) = 799.
    expect(Math.round((ETIQUETA_MM.largura / 25.4) * 203)).toBe(799)
    expect(PNG_PX.largura).toBe(ETIQUETA_MM.largura * PONTOS_POR_MM)
  })
  it("mantém o dpi nominal que a caixa anuncia", () => {
    expect(DPI_IMPRESSORA).toBe(203)
  })
})

/** 1×1 PNG branco válido (o menor PNG bem-formado que existe). */
const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAAC0lEQVR4nGNgAAIAAAUAAen63NgAAAAASUVORK5CYII="

function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function lerChunks(bytes: Uint8Array): Array<{ tipo: string; dados: Uint8Array }> {
  const chunks: Array<{ tipo: string; dados: Uint8Array }> = []
  let i = 8 // pula a assinatura
  while (i < bytes.length) {
    const tamanho = new DataView(bytes.buffer, bytes.byteOffset + i, 4).getUint32(0)
    const tipo = new TextDecoder().decode(bytes.slice(i + 4, i + 8))
    chunks.push({ tipo, dados: bytes.slice(i + 8, i + 8 + tamanho) })
    i += 4 + 4 + tamanho + 4 // tamanho + tipo + dados + crc
  }
  return chunks
}

describe("pngComResolucaoFisica", () => {
  it("insere pHYs logo após o IHDR, com 8 pontos/mm nos dois eixos", async () => {
    const original = base64ParaBytes(PNG_1X1_BASE64)
    const blob = new Blob([original.slice().buffer], { type: "image/png" })
    const saida = new Uint8Array(await (await pngComResolucaoFisica(blob)).arrayBuffer())

    const chunks = lerChunks(saida)
    expect(chunks[0].tipo).toBe("IHDR")
    expect(chunks[1].tipo).toBe("pHYs")

    const v = new DataView(chunks[1].dados.buffer, chunks[1].dados.byteOffset)
    const porMetro = PONTOS_POR_MM * 1000
    expect(v.getUint32(0)).toBe(porMetro)
    expect(v.getUint32(4)).toBe(porMetro)
    expect(chunks[1].dados[8]).toBe(1) // unidade: metro

    // Nenhum outro chunk foi alterado ou perdido.
    expect(chunks.map((c) => c.tipo)).toEqual(["IHDR", "pHYs", "IDAT", "IEND"])
  })

  it("o CRC do chunk pHYs é válido (todo leitor de PNG confere isso)", async () => {
    const original = base64ParaBytes(PNG_1X1_BASE64)
    const saida = new Uint8Array(
      await (await pngComResolucaoFisica(new Blob([original.slice().buffer], { type: "image/png" }))).arrayBuffer(),
    )
    // pHYs começa em 33 (fim do IHDR): 4 (tamanho) + 4 (tipo) + 9 (dados) + 4 (crc) = 21 bytes.
    const chunkCompleto = saida.slice(33, 33 + 21)
    const crcLido = new DataView(chunkCompleto.buffer, chunkCompleto.byteOffset + 17, 4).getUint32(0)

    // Recalcula com a definição de CRC32 do PNG (RFC 2083), independente
    // da implementação testada.
    let crc = ~0
    for (const byte of chunkCompleto.slice(4, 17)) {
      crc ^= byte
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
    expect(crcLido).toBe(~crc >>> 0)
  })
})
