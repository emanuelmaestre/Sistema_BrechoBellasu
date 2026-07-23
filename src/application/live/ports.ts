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
  criar(compra: LiveCompra, itens: ItemCompraInput[]): Promise<{ id: number }>
  dadosCliente(clienteId: number): Promise<DadosCliente | null>
}

export interface ILiveProdutoRepository {
  quantidadeEsperada(compraId: number): Promise<number | null>
  listarVinculos(compraId: number): Promise<VinculoResumo[]>
  definirStatusCompra(compraId: number, status: string): Promise<void>
}
