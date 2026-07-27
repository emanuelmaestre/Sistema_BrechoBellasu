import { describe, expect, it } from "vitest"
import {
  normalizePenalidadeText,
  parseMotivoPenalidade,
  parsePenalidadeId,
  PENALIDADE_TEXTO_MAX,
} from "./penalidade"

describe("parsePenalidadeId", () => {
  it("aceita apenas inteiros positivos completos", () => {
    expect(parsePenalidadeId(12)).toBe(12)
    expect(parsePenalidadeId("12")).toBe(12)
    expect(parsePenalidadeId("12abc")).toBeNull()
    expect(parsePenalidadeId(0)).toBeNull()
    expect(parsePenalidadeId(1.5)).toBeNull()
  })
})

describe("parseMotivoPenalidade", () => {
  it("aceita somente motivos de dominio conhecidos", () => {
    expect(parseMotivoPenalidade("nao_pagou_prazo")).toBe("nao_pagou_prazo")
    expect(parseMotivoPenalidade("desistiu_apos_contemplar")).toBe(
      "desistiu_apos_contemplar"
    )
    expect(parseMotivoPenalidade("outro")).toBeNull()
  })
})

describe("normalizePenalidadeText", () => {
  it("normaliza texto opcional e rejeita tipos ou tamanhos invalidos", () => {
    expect(normalizePenalidadeText("  detalhe  ")).toEqual({
      valid: true,
      value: "detalhe",
    })
    expect(normalizePenalidadeText("   ")).toEqual({
      valid: true,
      value: null,
    })
    expect(normalizePenalidadeText(undefined)).toEqual({
      valid: true,
      value: null,
    })
    expect(normalizePenalidadeText(123)).toEqual({
      valid: false,
      value: null,
    })
    expect(normalizePenalidadeText("a".repeat(PENALIDADE_TEXTO_MAX + 1))).toEqual({
      valid: false,
      value: null,
    })
  })
})
