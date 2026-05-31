import { describe, it, expect } from "vitest"
import { ContaPagar } from "@/domain/financeiro/conta-pagar"
import { ContaReceber } from "@/domain/financeiro/conta-receber"
import { PagarContaUseCase } from "./contas-pagar.use-cases"
import { ReceberContaUseCase } from "./contas-receber.use-cases"
import type { IContaPagarRepository, IContaReceberRepository } from "./ports"
import type { ContaPagar as CP } from "@/domain/financeiro/conta-pagar"
import type { ContaReceber as CR } from "@/domain/financeiro/conta-receber"

describe("ContaPagar / ContaReceber", () => {
  it("cria conta válida", () => {
    expect(ContaPagar.criar({ descricao: "Aluguel", valor: 1200, vencimento: "2026-06-10" }).ok).toBe(true)
    expect(ContaReceber.criar({ descricao: "Venda", valor: 50, vencimento: "2026-06-10" }).ok).toBe(true)
  })

  it("rejeita descrição vazia, valor não-positivo e vencimento ausente", () => {
    expect(ContaPagar.criar({ descricao: "", valor: 10, vencimento: "2026-06-10" }).ok).toBe(false)
    expect(ContaPagar.criar({ descricao: "X", valor: 0, vencimento: "2026-06-10" }).ok).toBe(false)
    expect(ContaPagar.criar({ descricao: "X", valor: 10, vencimento: "" }).ok).toBe(false)
  })
})

describe("PagarContaUseCase / ReceberContaUseCase", () => {
  it("registra a data de pagamento (pago_em)", async () => {
    let recebido: { id: number; data: string } | null = null
    const repo: IContaPagarRepository = {
      async criar(_c: CP) {
        return { id: 1 }
      },
      async marcarPago(id: number, pagoEm: string) {
        recebido = { id, data: pagoEm }
      },
    }
    const r = await new PagarContaUseCase(repo).execute(7, "2026-05-31")
    expect(r.ok).toBe(true)
    expect(recebido).toEqual({ id: 7, data: "2026-05-31" })
  })

  it("registra a data de recebimento (recebido_em)", async () => {
    let recebido: { id: number; data: string } | null = null
    const repo: IContaReceberRepository = {
      async criar(_c: CR) {
        return { id: 1 }
      },
      async marcarRecebido(id: number, recebidoEm: string) {
        recebido = { id, data: recebidoEm }
      },
    }
    const r = await new ReceberContaUseCase(repo).execute(9, "2026-05-31")
    expect(r.ok).toBe(true)
    expect(recebido).toEqual({ id: 9, data: "2026-05-31" })
  })

  it("rejeita id inválido", async () => {
    const repo: IContaPagarRepository = {
      async criar(_c: CP) {
        return { id: 1 }
      },
      async marcarPago() {},
    }
    expect((await new PagarContaUseCase(repo).execute(0, "2026-05-31")).ok).toBe(false)
  })
})
