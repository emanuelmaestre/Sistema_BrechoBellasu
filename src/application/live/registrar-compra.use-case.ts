// ══════════════════════════════════════════════════════════════════
// RegistrarCompraLiveUseCase — registra a compra da live e gera a
// cobrança (link de pagamento), salvando-a. Resolve dados do cliente
// quando há clienteId. Orquestra repo + gateway de pagamento.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok } from "@/domain/shared/result"
import { LiveCompra, type LiveCompraInput } from "@/domain/live/live-compra"
import type { ILiveCompraRepository, IPagamentoGateway, ItemCompraInput } from "./ports"

export interface RegistrarCompraInput extends LiveCompraInput {
  cpf?: string | null
  itens?: ItemCompraInput[]
  tipoLive?: "novidades" | "promocional"
  clienteIdParaCredito?: number | null
}

export interface RegistrarCompraOutput {
  id: number
  linkPagamento: string | null
}

export class RegistrarCompraLiveUseCase {
  constructor(
    private readonly compras: ILiveCompraRepository,
  ) {}

  async execute(input: RegistrarCompraInput): Promise<Result<RegistrarCompraOutput>> {
    // 1. Resolve dados do cliente (preenche o que não veio no payload)
    let nomeCliente = input.nomeCliente ?? null
    let whatsapp = input.whatsapp ?? null
    if (input.clienteId) {
      const dados = await this.compras.dadosCliente(input.clienteId)
      if (dados) {
        nomeCliente = nomeCliente ?? dados.nome
        whatsapp = whatsapp ?? dados.whatsapp
      }
    }

    // 2. Monta e valida a entidade
    const compraResult = LiveCompra.criar({ ...input, nomeCliente, whatsapp })
    if (!compraResult.ok) return compraResult
    const compra = compraResult.value

    // 3. Persiste compra + itens
    const { id } = await this.compras.criar(compra, input.itens ?? [])

    return ok({ id, linkPagamento: null })
  }
}
