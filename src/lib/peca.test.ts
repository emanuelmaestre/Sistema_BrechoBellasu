import { describe, it, expect } from "vitest"
import { parsePrecoBR, formatarPrecoBR, descontoPct, nomeComCor } from "./peca"

describe("parsePrecoBR", () => {
  it("lê valores no formato brasileiro", () => {
    expect(parsePrecoBR("19,90")).toBe(19.9)
    expect(parsePrecoBR("1.234,50")).toBe(1234.5)
    expect(parsePrecoBR("25")).toBe(25)
  })
  it("vazio, nulo e lixo viram 0", () => {
    expect(parsePrecoBR("")).toBe(0)
    expect(parsePrecoBR(null)).toBe(0)
    expect(parsePrecoBR("abc")).toBe(0)
  })
})

describe("formatarPrecoBR", () => {
  it("formata com duas casas", () => {
    expect(formatarPrecoBR(19.9)).toBe("19,90")
    expect(parsePrecoBR(formatarPrecoBR(1234.5))).toBe(1234.5)
  })
})

describe("descontoPct", () => {
  it("calcula o desconto arredondado", () => {
    expect(descontoPct(100, 75)).toBe(25)
  })
  it("sem desconto quando falta valor ou o preço não é menor", () => {
    expect(descontoPct(0, 50)).toBe(0)
    expect(descontoPct(50, 0)).toBe(0)
    expect(descontoPct(50, 60)).toBe(0)
  })
})

describe("nomeComCor", () => {
  it("junta nome e cor", () => {
    expect(nomeComCor("  Vestido   midi ", "azul")).toBe("Vestido midi - AZUL")
  })
  it("sem cor mantém só o nome", () => {
    expect(nomeComCor("Blusa", "")).toBe("Blusa")
  })
})
