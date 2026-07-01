import { describe, it, expect } from "vitest"
import { calcularStatusCompra, validarFinalizacao, type VinculoResumo } from "./status-compra"

const v = (quantidade: number, estoqueBaixado: boolean): VinculoResumo => ({ quantidade, estoqueBaixado })

describe("calcularStatusCompra", () => {
  it("aguardando_vinculo quando não há vínculos", () => {
    expect(calcularStatusCompra(3, [])).toBe("aguardando_vinculo")
  })
  it("vinculo_parcial quando vinculou menos que o esperado", () => {
    expect(calcularStatusCompra(3, [v(1, true)])).toBe("vinculo_parcial")
  })
  it("finalizada quando vinculou tudo e baixou tudo (auto-finaliza)", () => {
    expect(calcularStatusCompra(2, [v(1, true), v(1, true)])).toBe("finalizada")
  })
  it("vinculo_parcial quando vinculou mas não baixou tudo", () => {
    expect(calcularStatusCompra(2, [v(2, false)])).toBe("vinculo_parcial")
  })
})

describe("validarFinalizacao", () => {
  it("ok quando completo", () => {
    expect(validarFinalizacao(2, [v(2, true)]).ok).toBe(true)
  })
  it("recusa sem vínculos", () => {
    expect(validarFinalizacao(2, []).ok).toBe(false)
  })
  it("recusa quantidade divergente", () => {
    const r = validarFinalizacao(3, [v(1, true)])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("FINALIZACAO_INVALIDA")
  })
  it("recusa quando nem tudo foi baixado", () => {
    expect(validarFinalizacao(2, [v(2, false)]).ok).toBe(false)
  })
})
