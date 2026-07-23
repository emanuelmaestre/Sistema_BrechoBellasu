import { describe, expect, it } from "vitest"
import { ListarProdutosUseCase } from "./listar-produtos.use-case"
import type { IProdutoRepository, ProdutoListFilters, ProdutoListResult } from "./ports"

class FakeProdutoRepository implements IProdutoRepository {
  lastFilters?: Required<ProdutoListFilters> & { offset: number }

  async listar(filtros: Required<ProdutoListFilters> & { offset: number }): Promise<ProdutoListResult> {
    this.lastFilters = filtros
    return { data: [], total: 0 }
  }

  async criar(): Promise<{ id: number }> {
    return { id: 1 }
  }

  async buscarEstoque(): Promise<number | null> {
    return 0
  }

  async definirEstoque(_id: number, novo: number): Promise<number> {
    return novo
  }
}

describe("ListarProdutosUseCase", () => {
  it("normaliza paginacao, filtros e ordenacao", async () => {
    const repo = new FakeProdutoRepository()
    await new ListarProdutosUseCase(repo).execute({
      busca: "  vestido  ",
      categoriaId: " 7 ",
      marca: "  Bellasu ",
      page: 3.8,
      limit: 25.9,
      ordemCodigo: "desc",
    })

    expect(repo.lastFilters).toEqual({
      busca: "vestido",
      categoriaId: "7",
      marca: "Bellasu",
      page: 3,
      limit: 25,
      offset: 50,
      ordemCodigo: "desc",
    })
  })

  it("usa defaults seguros para pagina e limite invalidos", async () => {
    const repo = new FakeProdutoRepository()
    await new ListarProdutosUseCase(repo).execute({ page: Number.NaN, limit: 0 })

    expect(repo.lastFilters).toMatchObject({
      page: 1,
      limit: 1,
      offset: 0,
      ordemCodigo: "asc",
    })
  })

  it("limita page e limit ao intervalo permitido", async () => {
    const repo = new FakeProdutoRepository()
    await new ListarProdutosUseCase(repo).execute({ page: -10, limit: 20000 })

    expect(repo.lastFilters).toMatchObject({
      page: 1,
      limit: 9999,
      offset: 0,
    })
  })
})
