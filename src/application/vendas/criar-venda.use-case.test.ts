import { describe, it, expect } from "vitest"
import { CriarVendaUseCase } from "./criar-venda.use-case"
import type { IVendaRepository, EstoqueReader, VendaPersistida } from "./ports"
import type { Venda } from "@/domain/vendas/venda"

// ── Fakes in-memory: provam que o use case é testável sem banco ──
class FakeVendaRepository implements IVendaRepository {
  ultimaVenda: Venda | null = null
  cancelados: number[] = []
  async criar(venda: Venda): Promise<VendaPersistida> {
    this.ultimaVenda = venda
    return { id: 123, total: venda.total.reais }
  }
  async cancelar(id: number): Promise<void> {
    this.cancelados.push(id)
  }
}

class FakeEstoqueReader implements EstoqueReader {
  constructor(private readonly mapa: Record<number, number | null>) {}
  async disponivel(produtoId: number): Promise<number | null> {
    return produtoId in this.mapa ? this.mapa[produtoId] : null
  }
}

describe("CriarVendaUseCase", () => {
  it("cria a venda quando há estoque suficiente", async () => {
    const repo = new FakeVendaRepository()
    const uc = new CriarVendaUseCase(repo, new FakeEstoqueReader({ 1: 10 }))

    const r = await uc.execute({
      vendedorId: 1,
      itens: [{ produtoId: 1, nome: "Camiseta", quantidade: 2, precoUnitario: 19.9 }],
    })

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.id).toBe(123)
      expect(r.value.total).toBe(39.8)
    }
    expect(repo.ultimaVenda).not.toBeNull()
  })

  it("bloqueia quando o estoque é insuficiente (e não persiste)", async () => {
    const repo = new FakeVendaRepository()
    const uc = new CriarVendaUseCase(repo, new FakeEstoqueReader({ 1: 1 }))

    const r = await uc.execute({
      vendedorId: 1,
      itens: [{ produtoId: 1, nome: "Camiseta", quantidade: 5, precoUnitario: 19.9 }],
    })

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("ESTOQUE_INSUFICIENTE")
    expect(repo.ultimaVenda).toBeNull()
  })

  it("não valida estoque de item sem produtoId (produto avulso)", async () => {
    const repo = new FakeVendaRepository()
    const uc = new CriarVendaUseCase(repo, new FakeEstoqueReader({}))

    const r = await uc.execute({
      vendedorId: 1,
      itens: [{ produtoId: null, nome: "Avulso", quantidade: 99, precoUnitario: 5 }],
    })

    expect(r.ok).toBe(true)
  })

  it("propaga erro de domínio sem chamar o repositório", async () => {
    const repo = new FakeVendaRepository()
    const uc = new CriarVendaUseCase(repo, new FakeEstoqueReader({}))

    const r = await uc.execute({ vendedorId: 1, itens: [] })

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("VENDA_SEM_ITENS")
    expect(repo.ultimaVenda).toBeNull()
  })
})
