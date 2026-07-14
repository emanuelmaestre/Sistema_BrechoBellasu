import { describe, it, expect } from "vitest"
import { RegistrarCompraLiveUseCase } from "./registrar-compra.use-case"
import type {
  ILiveCompraRepository,
  ItemCompraInput,
  DadosCliente,
  PendenteComPagamento,
} from "./ports"
import type { LiveCompra } from "@/domain/live/live-compra"

class FakeRepo implements ILiveCompraRepository {
  pagamentos: Record<number, { url: string; paymentId: string }> = {}
  ultima: LiveCompra | null = null
  constructor(private cliente: DadosCliente | null = null) {}
  async criar(compra: LiveCompra): Promise<{ id: number }> {
    this.ultima = compra
    return { id: 55 }
  }
  async salvarPagamento(compraId: number, dados: { url: string; paymentId: string }) {
    this.pagamentos[compraId] = dados
  }
  async dadosCliente(): Promise<DadosCliente | null> {
    return this.cliente
  }
  async listarPendentes(): Promise<PendenteComPagamento[]> {
    return []
  }
  async marcarPago(): Promise<void> {}
}

const itens: ItemCompraInput[] = [{ nomeProduto: "Blusa", quantidade: 1, precoUnitario: 70 }]

describe("RegistrarCompraLiveUseCase", () => {
  it("cria a compra e NÃO gera link de pagamento (pagamento é por PIX manual no disparo)", async () => {
    const repo = new FakeRepo()
    const uc = new RegistrarCompraLiveUseCase(repo)

    const r = await uc.execute({ liveId: 1, nomeCliente: "Ana", valorTotal: 70, itens })

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.id).toBe(55)
      expect(r.value.linkPagamento).toBeNull()
    }
    // a compra foi persistida e nenhum pagamento/cobrança foi gerado
    expect(repo.ultima).not.toBeNull()
    expect(repo.pagamentos).toEqual({})
  })

  it("não gera cobrança quando o valor final é zero", async () => {
    const repo = new FakeRepo()
    const uc = new RegistrarCompraLiveUseCase(repo)

    const r = await uc.execute({ liveId: 1, valorTotal: 50, desconto: 50 })

    expect(r.ok && r.value.linkPagamento).toBeNull()
    expect(repo.pagamentos).toEqual({})
  })

  it("resolve nome/whatsapp do cliente quando só vem clienteId", async () => {
    const repo = new FakeRepo({ nome: "João", whatsapp: "9999", cpf: "52998224725" })
    const uc = new RegistrarCompraLiveUseCase(repo)

    await uc.execute({ liveId: 1, clienteId: 9, valorTotal: 40 })

    expect(repo.ultima?.nomeCliente).toBe("João")
    expect(repo.ultima?.whatsapp).toBe("9999")
  })
})
