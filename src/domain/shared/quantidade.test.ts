import { describe, it, expect } from "vitest"
import { Quantidade } from "./quantidade"

describe("Quantidade", () => {
  it("aceita inteiro positivo", () => {
    const r = Quantidade.criar(3)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.valor).toBe(3)
  })

  it("rejeita zero e negativos", () => {
    expect(Quantidade.criar(0).ok).toBe(false)
    expect(Quantidade.criar(-2).ok).toBe(false)
  })

  it("rejeita não inteiros", () => {
    expect(Quantidade.criar(1.5).ok).toBe(false)
  })
})
