// ══════════════════════════════════════════════════════════════════
// Contratos do módulo de Live. Os use cases dependem destas abstrações.
// O gateway de pagamento é uma porta: hoje Asaas, amanhã outro, sem
// alterar a regra de negócio.
// ══════════════════════════════════════════════════════════════════
import type { LiveCompra } from "@/domain/live/live-compra"
import type { VinculoResumo } from "@/domain/live/status-compra"

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

export type LiveStatus = "aberta" | "encerrada" | "disparada"
export type LiveTipo = "novidades" | "promocional"

export interface LiveListItem {
  id: number
  titulo: string
  data_live: string
  status: LiveStatus
  tipo?: LiveTipo | null
  plataforma?: string | null
  observacoes?: string | null
  link_live?: string | null
  created_at?: string
}

export interface ListarLivesInput {
  status?: string | null
  page?: number
  limit?: number
}

export interface ListarLivesOutput {
  data: LiveListItem[]
  total: number | null
}

export interface CriarLiveInput {
  titulo?: string | null
  dataLive?: string | null
  plataforma?: string | null
  tipo?: LiveTipo | null
  observacoes?: string | null
  linkLive?: string | null
}

export interface CriarLivePersistida {
  titulo: string
  dataLive: string
  plataforma: string | null
  tipo: LiveTipo
  observacoes: string | null
  linkLive: string | null
}

export interface ILiveRepository {
  listar(input: Required<Pick<ListarLivesInput, "page" | "limit">> & { status?: LiveStatus | null }): Promise<ListarLivesOutput>
  criar(input: CriarLivePersistida): Promise<LiveListItem>
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

export interface ILiveProdutoRepository {
  /** Quantidade de itens esperada da compra, ou null se a compra não existe. */
  quantidadeEsperada(compraId: number): Promise<number | null>
  /** Produtos vinculados à compra (quantidade + se baixou estoque). */
  listarVinculos(compraId: number): Promise<VinculoResumo[]>
  /** Define o status_compra. */
  definirStatusCompra(compraId: number, status: string): Promise<void>
}
