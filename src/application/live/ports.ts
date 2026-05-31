// ══════════════════════════════════════════════════════════════════
// Contratos do módulo de Live. Os use cases dependem destas abstrações.
// O gateway de pagamento é uma porta: hoje Asaas, amanhã outro, sem
// alterar a regra de negócio.
// ══════════════════════════════════════════════════════════════════
import type { LiveCompra } from "@/domain/live/live-compra"

export interface ItemCompraInput {
  produtoId?: number | null
  nomeProduto: string
  quantidade: number
  precoUnitario: number
  descontoItem?: number
  ehLive?: boolean
}

export interface DadosCliente {
  nome: string | null
  whatsapp: string | null
  cpf: string | null
}

export interface PendenteComPagamento {
  id: number
  asaasPaymentId: string | null
}

export interface ILiveCompraRepository {
  /** Persiste a compra e seus itens; retorna o id da compra. */
  criar(compra: LiveCompra, itens: ItemCompraInput[]): Promise<{ id: number }>
  /** Salva o link/identificador da cobrança gerada. */
  salvarPagamento(compraId: number, dados: { url: string; paymentId: string }): Promise<void>
  /** Dados do cliente para a cobrança (nome/whatsapp/cpf), ou null. */
  dadosCliente(clienteId: number): Promise<DadosCliente | null>
  /** Compras da live ainda não pagas que possuem cobrança. */
  listarPendentes(liveId: number): Promise<PendenteComPagamento[]>
  /** Marca a compra como paga. */
  marcarPago(compraId: number): Promise<void>
}

export interface CobrancaParams {
  nome: string
  cpf: string | null
  valor: number // em reais
  descricao: string
  tipoLive: "novidades" | "promocional"
}

export interface IPagamentoGateway {
  gerarCobranca(params: CobrancaParams): Promise<{ url: string; paymentId: string } | null>
  consultarStatus(paymentId: string): Promise<"PAGO" | "EM_ABERTO" | null>
}
