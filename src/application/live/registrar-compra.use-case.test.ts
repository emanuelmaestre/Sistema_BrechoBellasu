import { describe, it, expect } from "vitest"
import { RegistrarCompraLiveUseCase } from "./registrar-compra.use-case"
import type {
  ILiveCompraRepository,
  IPagamentoGateway,
  ItemCompraInput,
  DadosCliente,
  PendenteComPagamento,
  CobrancaParams,
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

class FakeGateway implements IPagamentoGateway {
  chamadas: CobrancaParams[] = []
  constructor(private retorno: { url: string; paymentId: string } | null = { url: "http://pay/x", paymentId: "pay_1" }) {}
  async gerarCobranca(p: CobrancaParams) {
    this.chamadas.push(p)
    return this.retorno
  }
  async consultarStatus() {
    return "EM_ABERTO" as const
  }
}

const itens: ItemCompraInput[] = [{ nomeProduto: "Blusa", quantidade: 1, precoUnitario: 70 }]

describe("RegistrarCompraLiveUseCase", () => {
  it("cria compra e salva o link de pagamento quando há valor", async () => {
    const repo = new FakeRepo()
    const gw = new FakeGateway()
    const uc = new RegistrarCompraLiveUseCase(repo, gw)

    const r = await uc.execute({ liveId: 1, nomeCliente: "Ana", valorTotal: 70, itens })

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.id).toBe(55)
      expect(r.value.linkPagamento).toBe("http://pay/x")
    }
    // o link foi PERSISTIDO (o bug original não salvava)
    expect(repo.pagamentos[55]).toEqual({ url: "http://pay/x", paymentId: "pay_1" })
    expect(gw.chamadas[0].valor).toBe(70)
  })

  it("não gera cobrança quando o valor final é zero", async () => {
    const repo = new FakeRepo()
    const gw = new FakeGateway()
    const uc = new RegistrarCompraLiveUseCase(repo, gw)

    const r = await uc.execute({ liveId: 1, valorTotal: 50, desconto: 50 })

    expect(r.ok && r.value.linkPagamento).toBeNull()
    expect(gw.chamadas).toHaveLength(0)
  })

  it("resolve nome/cpf do cliente quando só vem clienteId", async () => {
    const repo = new FakeRepo({ nome: "João", whatsapp: "9999", cpf: "52998224725" })
    const gw = new FakeGateway()
    const uc = new RegistrarCompraLiveUseCase(repo, gw)

    await uc.execute({ liveId: 1, clienteId: 9, valorTotal: 40 })

    expect(gw.chamadas[0].nome).toBe("João")
    expect(gw.chamadas[0].cpf).toBe("52998224725")
  })
})
