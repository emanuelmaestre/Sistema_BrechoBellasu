import { describe, it, expect } from "vitest"
import { Troca } from "./troca"

describe("Troca", () => {
  it("cria troca válida com defaults", () => {
    const r = Troca.criar({ tipo: "troca", motivo: "Tamanho errado" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.status).toBe("solicitado")
      expect(r.value.quantidade).toBe(1)
    }
  })

  it("aceita devolucao", () => {
    expect(Troca.criar({ tipo: "devolucao", motivo: "Defeito" }).ok).toBe(true)
  })

  it("rejeita tipo inválido e motivo vazio", () => {
    expect(Troca.criar({ tipo: "outro", motivo: "x" }).ok).toBe(false)
    expect(Troca.criar({ tipo: "troca", motivo: "  " }).ok).toBe(false)
  })
})
