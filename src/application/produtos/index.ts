// Barrel da aplicação de Produtos.
export { AjustarEstoqueUseCase } from "./ajustar-estoque.use-case"
export { CriarProdutoUseCase, type CriarProdutoInput } from "./criar-produto.use-case"
export { ListarProdutosUseCase, type ListarProdutosInput } from "./listar-produtos.use-case"
export type { IProdutoRepository, ProdutoListFilters, ProdutoListItem, ProdutoListResult } from "./ports"
