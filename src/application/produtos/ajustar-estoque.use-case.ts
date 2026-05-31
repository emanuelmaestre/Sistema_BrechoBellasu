// AjustarEstoqueUseCase — aplica add/sub/set garantindo estoque ≥ 0.
import { type Result, ok, err } from "@/domain/shared/result"
import { ValidacaoError } from "@/domain/shared/domain-error"
import { calcularNovoEstoque, type OperacaoEstoque } from "@/domain/produtos/estoque"
import { ProdutoNaoEncontradoError } from "@/domain/produtos/errors"
import type { IProdutoRepository } from "./ports"

export class AjustarEstoqueUseCase {
  constructor(private readonly produtos: IProdutoRepository) {}

  async execute(
    id: number,
    operacao: OperacaoEstoque,
    quantidade: number,
  ): Promise<Result<{ estoqueAtual: number }>> {
    if (!Number.isInteger(id) || id <= 0) {
      return err(new ValidacaoError("ID de produto inválido."))
    }

    const atual = await this.produtos.buscarEstoque(id)
    if (atual === null) return err(new ProdutoNaoEncontradoError())

    const novo = calcularNovoEstoque(atual, operacao, quantidade)
    if (!novo.ok) return novo

    const persistido = await this.produtos.definirEstoque(id, novo.value)
    return ok({ estoqueAtual: persistido })
  }
}
