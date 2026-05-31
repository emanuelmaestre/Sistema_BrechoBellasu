import { describe, it, expect } from "vitest"
import { Cliente } from "./cliente"

describe("Cliente", () => {
  it("cria com nome e normaliza campos vazios para null", () => {
    const r = Cliente.criar({ nome: "  Maria  ", celular: "  " })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.nome).toBe("Maria")
      expect(r.value.celular).toBeNull()
    }
  })

  it("exige nome", () => {
    expect(Cliente.criar({ nome: "  " }).ok).toBe(false)
  })

  it("valida CPF quando preenchido", () => {
    expect(Cliente.criar({ nome: "X", cpfCnpj: "529.982.247-25" }).ok).toBe(true)
    expect(Cliente.criar({ nome: "X", cpfCnpj: "111.111.111-11" }).ok).toBe(false)
  })

  it("aceita cliente sem CPF (campo opcional)", () => {
    expect(Cliente.criar({ nome: "X", cpfCnpj: "" }).ok).toBe(true)
  })

  it("valida e-mail quando preenchido", () => {
    expect(Cliente.criar({ nome: "X", email: "a@b.com" }).ok).toBe(true)
    expect(Cliente.criar({ nome: "X", email: "invalido" }).ok).toBe(false)
  })

  it("normaliza UF e rejeita tamanho errado", () => {
    const r = Cliente.criar({ nome: "X", estado: "sp" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.estado).toBe("SP")
    expect(Cliente.criar({ nome: "X", estado: "São Paulo" }).ok).toBe(false)
  })
})
