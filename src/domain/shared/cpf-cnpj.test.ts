import { describe, it, expect } from "vitest"
import { CpfCnpj } from "./cpf-cnpj"

describe("CpfCnpj", () => {
  it("aceita CPF válido (com ou sem máscara) e normaliza", () => {
    const r = CpfCnpj.criar("529.982.247-25")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.valor).toBe("52998224725")
  })

  it("rejeita CPF com dígito verificador errado", () => {
    expect(CpfCnpj.criar("529.982.247-24").ok).toBe(false)
  })

  it("rejeita CPF com todos os dígitos iguais", () => {
    expect(CpfCnpj.criar("111.111.111-11").ok).toBe(false)
  })

  it("aceita CNPJ válido", () => {
    const r = CpfCnpj.criar("11.222.333/0001-81")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.ehCnpj).toBe(true)
  })

  it("rejeita CNPJ inválido e comprimentos errados", () => {
    expect(CpfCnpj.criar("11.222.333/0001-80").ok).toBe(false)
    expect(CpfCnpj.criar("123").ok).toBe(false)
  })
})
