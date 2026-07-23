import type { IProdutoRepository, ProdutoListFilters, ProdutoListResult } from "./ports"

export type ListarProdutosInput = ProdutoListFilters

function normalizarInteiro(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value ?? fallback)))
}

export class ListarProdutosUseCase {
  constructor(private readonly produtos: IProdutoRepository) {}

  async execute(input: ListarProdutosInput = {}): Promise<ProdutoListResult> {
    const page = normalizarInteiro(input.page, 1, 1, Number.MAX_SAFE_INTEGER)
    const limit = normalizarInteiro(input.limit, 50, 1, 9999)
    const offset = (page - 1) * limit

    return this.produtos.listar({
      busca: input.busca?.trim() || null,
      categoriaId: input.categoriaId?.trim() || null,
      marca: input.marca?.trim() || null,
      ordemCodigo: input.ordemCodigo === "desc" ? "desc" : "asc",
      page,
      limit,
      offset,
    })
  }
}
