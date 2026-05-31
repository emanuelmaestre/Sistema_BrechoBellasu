// Use cases de Contas a Receber.
import { type Result, ok, err } from "@/domain/shared/result"
import { ValidacaoError } from "@/domain/shared/domain-error"
import { ContaReceber, type ContaReceberInput } from "@/domain/financeiro/conta-receber"
import type { IContaReceberRepository } from "./ports"

export class CriarContaReceberUseCase {
  constructor(private readonly repo: IContaReceberRepository) {}
  async execute(input: ContaReceberInput): Promise<Result<{ id: number }>> {
    const conta = ContaReceber.criar(input)
    if (!conta.ok) return conta
    const { id } = await this.repo.criar(conta.value)
    return ok({ id })
  }
}

export class ReceberContaUseCase {
  constructor(private readonly repo: IContaReceberRepository) {}
  async execute(id: number, recebidoEm: string): Promise<Result<void>> {
    if (!Number.isInteger(id) || id <= 0) {
      return err(new ValidacaoError("ID de conta inválido."))
    }
    await this.repo.marcarRecebido(id, recebidoEm)
    return ok(undefined)
  }
}
