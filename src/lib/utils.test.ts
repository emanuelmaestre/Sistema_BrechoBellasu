import { describe, it, expect } from "vitest"
import { fmtData, hojeISO } from "./utils"

describe("hojeISO", () => {
  it("usa o fuso da loja, não UTC", () => {
    // 22h30 de 14/09 em Ribeirão Preto já é 15/09 em UTC. O sistema tem
    // que enxergar 14, porque é a noite em que a live está acontecendo.
    expect(hojeISO(new Date("2026-09-15T01:30:00Z"))).toBe("2026-09-14")
  })
  it("o cálculo em UTC erraria justamente nesse horário", () => {
    const noite = new Date("2026-09-15T01:30:00Z")
    expect(noite.toISOString().split("T")[0]).toBe("2026-09-15")
    expect(hojeISO(noite)).not.toBe(noite.toISOString().split("T")[0])
  })
  it("de dia os dois coincidem", () => {
    const tarde = new Date("2026-09-14T18:00:00Z")
    expect(hojeISO(tarde)).toBe("2026-09-14")
  })
  it("vira o dia só à meia-noite local", () => {
    expect(hojeISO(new Date("2026-09-15T02:59:59Z"))).toBe("2026-09-14")
    expect(hojeISO(new Date("2026-09-15T03:00:00Z"))).toBe("2026-09-15")
  })
  it("sai no formato que o input date e o Postgres esperam", () => {
    expect(hojeISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it("não congela entre chamadas em dias diferentes", () => {
    // O bug: um `const` de módulo devolveria o mesmo valor sempre.
    expect(hojeISO(new Date("2026-09-14T15:00:00Z")))
      .not.toBe(hojeISO(new Date("2026-09-18T15:00:00Z")))
  })
})

describe("fmtData", () => {
  it("formata sem deslocar o dia", () => {
    expect(fmtData("2026-09-14")).toBe("14/09/2026")
    expect(fmtData("2026-09-14T03:00:00.000Z")).toBe("14/09/2026")
  })
  it("mostra travessão quando não há data", () => {
    expect(fmtData(null)).toBe("—")
  })
})
