import { describe, it, expect } from "vitest"
import { calcularNovoEstoque } from "./estoque"

describe("calcularNovoEstoque", () => {
  it("adiciona", () => {
    const r = calcularNovoEstoque(5, "add", 3)
    expect(r.ok && r.value).toBe(8)
  })

  it("subtrai dentro do limite", () => {
    const r = calcularNovoEstoque(5, "sub", 5)
    expect(r.ok && r.value).toBe(0)
  })

  it("bloqueia subtração abaixo de zero", () => {
    const r = calcularNovoEstoque(2, "sub", 5)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("ESTOQUE_NEGATIVO")
  })

  it("define valor absoluto (set)", () => {
    const r = calcularNovoEstoque(5, "set", 20)
    expect(r.ok && r.value).toBe(20)
  })

  it("rejeita quantidade negativa ou fracionária", () => {
    expect(calcularNovoEstoque(5, "add", -1).ok).toBe(false)
    expect(calcularNovoEstoque(5, "add", 1.5).ok).toBe(false)
  })
})
