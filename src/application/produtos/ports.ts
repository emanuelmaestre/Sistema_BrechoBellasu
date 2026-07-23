import type { Produto } from "@/domain/produtos/produto"

export type ProdutoListFilters = {
  busca?: string | null
  categoriaId?: string | null
  marca?: string | null
  page?: number
  limit?: number
  ordemCodigo?: "asc" | "desc"
}

export type ProdutoListItem = {
  id: number
  nome: string
  codigo: string | null
  codigo_num?: number | null
  categoria_id: number | null
  categoria_nome: string | null
  marca: string | null
  preco_venda: number
  preco_custo?: number | null
  estoque_atual: number
  controlar_estoque?: boolean | null
  unidade_medida?: string | null
  cor?: string | null
  tamanho?: string | null
}

export type ProdutoListResult = {
  data: ProdutoListItem[]
  total: number | null
}

export interface IProdutoRepository {
  listar(filtros: Required<ProdutoListFilters> & { offset: number }): Promise<ProdutoListResult>
  criar(produto: Produto): Promise<{ id: number }>
  buscarEstoque(id: number): Promise<number | null>
  definirEstoque(id: number, novo: number): Promise<number>
}
