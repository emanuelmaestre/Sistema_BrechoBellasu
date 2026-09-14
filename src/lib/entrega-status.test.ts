import { describe, it, expect } from "vitest"
import { normalizarStatusEntrega, statusAvanca, marcosEntrega } from "./entrega-status"

describe("normalizarStatusEntrega", () => {
  it("aceita os status da Z-API e o formato antigo DELIVERED", () => {
    expect(normalizarStatusEntrega("received")).toBe("RECEIVED")
    expect(normalizarStatusEntrega("DELIVERED")).toBe("RECEIVED")
    expect(normalizarStatusEntrega("READ")).toBe("READ")
  })
  it("ignora status desconhecido", () => {
    expect(normalizarStatusEntrega("QUALQUER")).toBeNull()
    expect(normalizarStatusEntrega(undefined)).toBeNull()
  })
})

describe("statusAvanca", () => {
  it("avança de nada para enviado e de entregue para lida", () => {
    expect(statusAvanca(null, "SENT")).toBe(true)
    expect(statusAvanca("RECEIVED", "READ")).toBe(true)
  })
  it("nunca rebaixa (READ chegando antes de RECEIVED)", () => {
    expect(statusAvanca("READ", "RECEIVED")).toBe(false)
    expect(statusAvanca("READ", "READ")).toBe(false)
  })
})

describe("marcosEntrega", () => {
  it("lida também conta como entregue", () => {
    expect(marcosEntrega("READ", "t")).toEqual({ entregue: "t", lida: "t" })
    expect(marcosEntrega("RECEIVED", "t")).toEqual({ entregue: "t", lida: undefined })
    expect(marcosEntrega("SENT", "t")).toEqual({ entregue: undefined, lida: undefined })
  })
})
