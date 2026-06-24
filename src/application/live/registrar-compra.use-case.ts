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
    private readonly pagamento: IPagamentoGateway,
  ) {}

  async execute(input: RegistrarCompraInput): Promise<Result<RegistrarCompraOutput>> {
    // 1. Resolve dados do cliente (preenche o que não veio no payload)
    let nomeCliente = input.nomeCliente ?? null
    let whatsapp = input.whatsapp ?? null
    let cpf = input.cpf ?? null
    if (input.clienteId) {
      const dados = await this.compras.dadosCliente(input.clienteId)
      if (dados) {
        nomeCliente = nomeCliente ?? dados.nome
        whatsapp = whatsapp ?? dados.whatsapp
        cpf = cpf ?? dados.cpf
      }
    }

    // 2. Monta e valida a entidade
    const compraResult = LiveCompra.criar({ ...input, nomeCliente, whatsapp })
    if (!compraResult.ok) return compraResult
    const compra = compraResult.value

    // 3. Persiste compra + itens
    const { id } = await this.compras.criar(compra, input.itens ?? [])

    // 4. Gera e salva a cobrança (apenas se há valor a cobrar)
    let linkPagamento: string | null = null
    if (compra.valorFinal.centavos > 0) {
      const sacola = compra.descricaoSacola
      const cobranca = await this.pagamento.gerarCobranca({
        nome: compra.nomeCliente ?? "Cliente",
        cpf,
        valor: compra.valorFinal.reais,
        descricao: `Compra Live${sacola ? ` — Sacola ${sacola}` : ""}`,
        tipoLive: input.tipoLive ?? "novidades",
      })
      if (cobranca) {
        await this.compras.salvarPagamento(id, cobranca)
        linkPagamento = cobranca.url
      }
    }

    return ok({ id, linkPagamento })
  }
}
