// Use cases de Contas a Pagar.
import { type Result, ok, err } from "@/domain/shared/result"
import { ValidacaoError } from "@/domain/shared/domain-error"
import { ContaPagar, type ContaPagarInput } from "@/domain/financeiro/conta-pagar"
import type { IContaPagarRepository } from "./ports"

export class CriarContaPagarUseCase {
  constructor(private readonly repo: IContaPagarRepository) {}
  async execute(input: ContaPagarInput): Promise<Result<{ id: number }>> {
    const conta = ContaPagar.criar(input)
    if (!conta.ok) return conta
    const { id } = await this.repo.criar(conta.value)
    return ok({ id })
  }
}

export class PagarContaUseCase {
  constructor(private readonly repo: IContaPagarRepository) {}
  async execute(id: number, pagoEm: string): Promise<Result<void>> {
    if (!Number.isInteger(id) || id <= 0) {
      return err(new ValidacaoError("ID de conta inválido."))
    }
    await this.repo.marcarPago(id, pagoEm)
    return ok(undefined)
  }
}
