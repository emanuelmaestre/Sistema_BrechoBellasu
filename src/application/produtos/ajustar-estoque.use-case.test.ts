import { describe, it, expect } from "vitest"
import { AjustarEstoqueUseCase } from "./ajustar-estoque.use-case"
import type { IProdutoRepository } from "./ports"

class FakeProdutoRepository implements IProdutoRepository {
  constructor(private estoque: Record<number, number>) {}
  async listar() {
    return { data: [], total: 0 }
  }
  async criar(): Promise<{ id: number }> {
    return { id: 1 }
  }
  async buscarEstoque(id: number): Promise<number | null> {
    return id in this.estoque ? this.estoque[id] : null
  }
  async definirEstoque(id: number, novo: number): Promise<number> {
    this.estoque[id] = novo
    return novo
  }
}

describe("AjustarEstoqueUseCase", () => {
  it("subtrai dentro do disponível", async () => {
    const repo = new FakeProdutoRepository({ 7: 10 })
    const uc = new AjustarEstoqueUseCase(repo)
    const r = await uc.execute(7, "sub", 4)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.estoqueAtual).toBe(6)
  })

  it("recusa quando deixaria negativo", async () => {
    const repo = new FakeProdutoRepository({ 7: 3 })
    const uc = new AjustarEstoqueUseCase(repo)
    const r = await uc.execute(7, "sub", 5)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("ESTOQUE_NEGATIVO")
  })

  it("erro 404 para produto inexistente", async () => {
    const repo = new FakeProdutoRepository({})
    const uc = new AjustarEstoqueUseCase(repo)
    const r = await uc.execute(99, "add", 1)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("PRODUTO_NAO_ENCONTRADO")
  })
})
