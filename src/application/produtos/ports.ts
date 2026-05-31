// Contratos do módulo de Produtos. Use cases dependem destas abstrações.
import type { Produto } from "@/domain/produtos/produto"

export interface IProdutoRepository {
  /** Persiste um novo produto (gera código se necessário). Retorna o id. */
  criar(produto: Produto): Promise<{ id: number }>
  /** Estoque atual do produto, ou null se não existir. */
  buscarEstoque(id: number): Promise<number | null>
  /** Define o estoque absoluto e retorna o valor persistido. */
  definirEstoque(id: number, novo: number): Promise<number>
}
