import { describe, it, expect } from "vitest"
import { Money } from "./money"

describe("Money", () => {
  it("converte reais para centavos inteiros", () => {
    const r = Money.deReais(19.9)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.centavos).toBe(1990)
  })

  it("elimina erro de ponto flutuante (0.1 + 0.2)", () => {
    const a = Money.deReais(0.1)
    const b = Money.deReais(0.2)
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) {
      const soma = a.value.somar(b.value)
      expect(soma.centavos).toBe(30)
      expect(soma.reais).toBe(0.3)
    }
  })

  it("multiplica preço por quantidade sem perder centavos", () => {
    const preco = Money.deReais(9.99)
    if (preco.ok) {
      expect(preco.value.multiplicarPor(3).centavos).toBe(2997)
    }
  })

  it("rejeita valores não finitos", () => {
    expect(Money.deReais(Number.NaN).ok).toBe(false)
    expect(Money.deReais(Infinity).ok).toBe(false)
  })

  it("rejeita centavos não inteiros", () => {
    expect(Money.deCentavos(10.5).ok).toBe(false)
  })

  it("clampNaoNegativo nunca retorna negativo", () => {
    const dez = Money.deReais(10)
    const quinze = Money.deReais(15)
    if (dez.ok && quinze.ok) {
      const resultado = dez.value.subtrair(quinze.value)
      expect(resultado.ehNegativo()).toBe(true)
      expect(resultado.clampNaoNegativo().centavos).toBe(0)
    }
  })
})
