import { describe, it, expect } from "vitest"
import { VendaItem } from "./venda-item"

const base = { nome: "Vestido midi", quantidade: 1, precoUnitario: 50 }

function criar(cor?: string | null) {
  const r = VendaItem.criar({ ...base, cor })
  if (!r.ok) throw new Error("item deveria ser válido")
  return r.value
}

describe("VendaItem — cor da peça", () => {
  it("guarda a cor escolhida em maiúsculas, sem misturar no nome", () => {
    const item = criar("azul marinho")
    expect(item.cor).toBe("AZUL MARINHO")
    expect(item.nome).toBe("Vestido midi")
  })
  it("cor vazia, em branco ou ausente vira nula", () => {
    expect(criar("").cor).toBeNull()
    expect(criar("   ").cor).toBeNull()
    expect(criar(undefined).cor).toBeNull()
    expect(criar(null).cor).toBeNull()
  })
  it("limita a cor a 60 caracteres", () => {
    expect(criar("A".repeat(100)).cor).toHaveLength(60)
  })
})
