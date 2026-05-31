import { describe, it, expect } from "vitest"
import { Venda } from "./venda"

const itemBase = { produtoId: 1, nome: "Camiseta", quantidade: 2, precoUnitario: 19.9 }

describe("Venda", () => {
  it("calcula subtotal e total sem erro de float", () => {
    const r = Venda.criar({
      vendedorId: 1,
      itens: [
        { ...itemBase, precoUnitario: 0.1, quantidade: 1 },
        { produtoId: 2, nome: "Meia", precoUnitario: 0.2, quantidade: 1 },
      ],
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.subtotal.reais).toBe(0.3)
      expect(r.value.total.reais).toBe(0.3)
    }
  })

  it("aplica desconto e nunca deixa total negativo", () => {
    const r = Venda.criar({ vendedorId: 1, desconto: 100, itens: [itemBase] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      // subtotal = 39.80, desconto 100 → clamp em 0
      expect(r.value.subtotal.reais).toBe(39.8)
      expect(r.value.total.reais).toBe(0)
    }
  })

  it("rejeita venda sem itens", () => {
    const r = Venda.criar({ vendedorId: 1, itens: [] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("VENDA_SEM_ITENS")
  })

  it("rejeita desconto negativo", () => {
    const r = Venda.criar({ vendedorId: 1, desconto: -5, itens: [itemBase] })
    expect(r.ok).toBe(false)
  })

  it("propaga erro de item inválido (quantidade zero)", () => {
    const r = Venda.criar({ vendedorId: 1, itens: [{ ...itemBase, quantidade: 0 }] })
    expect(r.ok).toBe(false)
  })

  it("identifica itens que baixam estoque", () => {
    const r = Venda.criar({
      vendedorId: 1,
      itens: [
        { produtoId: 1, nome: "Com estoque", quantidade: 1, precoUnitario: 10 },
        { produtoId: null, nome: "Avulso", quantidade: 1, precoUnitario: 5 },
        { produtoId: 3, nome: "Sem controle", quantidade: 1, precoUnitario: 7, controlarEstoque: false },
      ],
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const controlados = r.value.itensControlados()
      expect(controlados).toHaveLength(1)
      expect(controlados[0].produtoId).toBe(1)
    }
  })
})
