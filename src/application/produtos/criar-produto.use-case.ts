// CriarProdutoUseCase — valida e persiste um novo produto.
import { type Result, ok } from "@/domain/shared/result"
import { Produto, type ProdutoInput } from "@/domain/produtos/produto"
import type { IProdutoRepository } from "./ports"

export type CriarProdutoInput = ProdutoInput

export class CriarProdutoUseCase {
  constructor(private readonly produtos: IProdutoRepository) {}

  async execute(input: CriarProdutoInput): Promise<Result<{ id: number }>> {
    const produto = Produto.criar(input)
    if (!produto.ok) return produto
    const { id } = await this.produtos.criar(produto.value)
    return ok({ id })
  }
}
