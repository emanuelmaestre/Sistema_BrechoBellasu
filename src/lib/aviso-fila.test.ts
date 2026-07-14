import { describe, it, expect } from "vitest"
import { ordenarFilaAviso, embaralhar } from "./aviso-fila"

type C = { id: number; nome: string }

const clientes: C[] = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, nome: `Cliente ${i + 1}` }))
// Compradoras: ids 1..4 (bloco prioritário); demais: 5..12
const compradoras = new Set([1, 2, 3, 4])

const ehCompradora = (c: C) => compradoras.has(c.id)

describe("ordenarFilaAviso", () => {
  it("mantém TODAS as compradoras antes de TODAS as demais (qualquer sorteio)", () => {
    for (let rodada = 0; rodada < 200; rodada++) {
      const fila = ordenarFilaAviso(clientes, compradoras, null)
      const idxUltimaCompradora = fila.map(ehCompradora).lastIndexOf(true)
      const idxPrimeiraDemais = fila.map(ehCompradora).indexOf(false)
      expect(idxUltimaCompradora).toBeLessThan(idxPrimeiraDemais)
    }
  })

  it("não perde nem duplica ninguém", () => {
    const fila = ordenarFilaAviso(clientes, compradoras, null)
    expect(fila).toHaveLength(clientes.length)
    expect(new Set(fila.map((c) => c.id))).toEqual(new Set(clientes.map((c) => c.id)))
  })

  it("varia a ordem entre disparos (não fica num padrão fixo)", () => {
    const ordens = new Set<string>()
    for (let i = 0; i < 30; i++) {
      ordens.add(ordenarFilaAviso(clientes, compradoras, null).map((c) => c.id).join(","))
    }
    // com 12 clientes é praticamente impossível cair sempre na mesma ordem
    expect(ordens.size).toBeGreaterThan(1)
  })

  it("a 1ª cliente nunca repete a 1ª do disparo anterior", () => {
    for (let rodada = 0; rodada < 200; rodada++) {
      const anterior = clientes[Math.floor(Math.random() * 4)].id // sempre uma compradora
      const fila = ordenarFilaAviso(clientes, compradoras, anterior)
      expect(fila[0].id).not.toBe(anterior)
      // e continua sendo uma compradora (bloco 1 preservado)
      expect(compradoras.has(fila[0].id)).toBe(true)
    }
  })

  it("quando não há compradoras, a 1ª sai do bloco DEMAIS e ainda respeita o anti-repetição", () => {
    for (let rodada = 0; rodada < 100; rodada++) {
      const anterior = 7
      const fila = ordenarFilaAviso(clientes, new Set<number>(), anterior)
      expect(fila[0].id).not.toBe(anterior)
    }
  })

  it("caso degenerado: só 1 compradora que era a 1ª anterior — não quebra", () => {
    const um: C[] = [{ id: 1, nome: "A" }, { id: 5, nome: "B" }]
    const fila = ordenarFilaAviso(um, new Set([1]), 1)
    // não há outra compradora para trocar; mantém a única compradora à frente
    expect(fila[0].id).toBe(1)
    expect(fila).toHaveLength(2)
  })

  it("lista vazia devolve vazio", () => {
    expect(ordenarFilaAviso([], compradoras, null)).toEqual([])
  })

  it("embaralhar não muta o array original", () => {
    const orig = [1, 2, 3, 4, 5]
    const copia = [...orig]
    embaralhar(orig)
    expect(orig).toEqual(copia)
  })
})
