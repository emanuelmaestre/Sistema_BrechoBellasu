// CancelarVendaUseCase — cancela uma venda (estorno de estoque fica no repositório).
import { type Result, ok, err } from "@/domain/shared/result"
import { ValidacaoError } from "@/domain/shared/domain-error"
import type { IVendaRepository } from "./ports"

export class CancelarVendaUseCase {
  constructor(private readonly vendas: IVendaRepository) {}

  async execute(id: number): Promise<Result<void>> {
    if (!Number.isInteger(id) || id <= 0) {
      return err(new ValidacaoError("ID de venda inválido."))
    }
    await this.vendas.cancelar(id)
    return ok(undefined)
  }
}
