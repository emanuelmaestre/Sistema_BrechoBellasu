// FinalizarCompraUseCase — valida (qtd vinculada == esperada, tudo baixado)
// e marca a compra como finalizada.
import { type Result, ok, err } from "@/domain/shared/result"
import { ValidacaoError } from "@/domain/shared/domain-error"
import { validarFinalizacao } from "@/domain/live/status-compra"
import { CompraNaoEncontradaError } from "@/domain/live/errors"
import type { ILiveProdutoRepository } from "./ports"

export class FinalizarCompraUseCase {
  constructor(private readonly repo: ILiveProdutoRepository) {}

  async execute(compraId: number): Promise<Result<void>> {
    if (!Number.isInteger(compraId) || compraId <= 0) {
      return err(new ValidacaoError("Compra inválida."))
    }

    const qtdEsperada = await this.repo.quantidadeEsperada(compraId)
    if (qtdEsperada === null) return err(new CompraNaoEncontradaError())

    const vinculos = await this.repo.listarVinculos(compraId)
    const valido = validarFinalizacao(qtdEsperada, vinculos)
    if (!valido.ok) return valido

    await this.repo.definirStatusCompra(compraId, "finalizada")
    return ok(undefined)
  }
}
