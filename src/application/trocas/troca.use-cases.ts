// Use cases de Trocas/Devoluções.
import { type Result, ok, err } from "@/domain/shared/result"
import { ValidacaoError } from "@/domain/shared/domain-error"
import { Troca, type TrocaInput } from "@/domain/trocas/troca"
import type { ITrocaRepository } from "./ports"

export class CriarTrocaUseCase {
  constructor(private readonly repo: ITrocaRepository) {}
  async execute(input: TrocaInput, responsavelId: number): Promise<Result<{ id: number }>> {
    const troca = Troca.criar(input)
    if (!troca.ok) return troca
    const { id } = await this.repo.criar(troca.value, responsavelId)
    return ok({ id })
  }
}

export class AtualizarStatusTrocaUseCase {
  constructor(private readonly repo: ITrocaRepository) {}
  async execute(
    id: number,
    status: string,
    decisaoProduto?: string | null,
    resultadoFin?: string | null,
  ): Promise<Result<void>> {
    if (!Number.isInteger(id) || id <= 0) {
      return err(new ValidacaoError("ID de troca inválido."))
    }
    if (!status?.trim()) {
      return err(new ValidacaoError("Status é obrigatório."))
    }
    await this.repo.atualizarStatus(id, status.trim(), decisaoProduto ?? null, resultadoFin ?? null)
    return ok(undefined)
  }
}
