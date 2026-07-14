import { describe, it, expect } from "vitest"
import { LiveCompra } from "./live-compra"

describe("LiveCompra", () => {
  it("calcula valor final = total − desconto", () => {
    const r = LiveCompra.criar({ liveId: 1, valorTotal: 100, desconto: 30 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.valorFinal.reais).toBe(70)
  })

  it("nunca deixa valor final negativo", () => {
    const r = LiveCompra.criar({ liveId: 1, valorTotal: 50, desconto: 80 })
    expect(r.ok && r.value.valorFinal.reais).toBe(0)
  })

  it("monta descrição da sacola", () => {
    const r = LiveCompra.criar({ liveId: 1, valorTotal: 10, numeroSacola: "12" })
    expect(r.ok && r.value.descricaoSacola).toBe("#12")
  })

  it("rejeita live inválida e valores negativos", () => {
    expect(LiveCompra.criar({ liveId: 0, valorTotal: 10 }).ok).toBe(false)
    expect(LiveCompra.criar({ liveId: 1, valorTotal: -5 }).ok).toBe(false)
    expect(LiveCompra.criar({ liveId: 1, valorTotal: 10, desconto: -1 }).ok).toBe(false)
  })
})
