import { describe, it, expect } from "vitest"
import { DPI_IMPRESSORA, PNG_PX, PONTOS_POR_MM } from "./etiqueta-export"
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
