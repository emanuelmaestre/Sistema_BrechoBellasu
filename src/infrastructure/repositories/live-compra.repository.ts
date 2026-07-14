// ══════════════════════════════════════════════════════════════════
// LiveCompraRepositorySupabase — implementação de ILiveCompraRepository.
// Usa as colunas REAIS do banco (confirmadas por introspecção):
//   • observacoes_compra (não "observacao")
//   • link_pagamento / asaas_payment_id / pagamento_status (migration 010)
//   • live_compra_itens exige live_compra_id/nome/preco_unit/qtd (NOT NULL)
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  ILiveCompraRepository,
  ItemCompraInput,
  DadosCliente,
  PendenteComPagamento,
} from "@/application/live/ports"
import type { LiveCompra } from "@/domain/live/live-compra"

export class LiveCompraRepositorySupabase implements ILiveCompraRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async criar(compra: LiveCompra, itens: ItemCompraInput[]): Promise<{ id: number }> {
    const { data, error } = await this.sb
      .from("live_compras")
      .insert({
        live_id: compra.liveId,
        cliente_id: compra.clienteId,
        nome_cliente: compra.nomeCliente,
        whatsapp: compra.whatsapp,
        data_compra: compra.dataCompra,
        numero_sacola: compra.numeroSacola,
        quantidade_itens: compra.quantidadeItens,
        valor_total: compra.valorTotal.reais,
        desconto: compra.desconto.reais,
        credito_aplicado: compra.creditoAplicado.reais,
        observacoes_compra: compra.observacoes,
      })
      .select("id")
      .single()

    if (error) throw new Error(error.message)
    const id = data.id as number

    if (itens.length > 0) {
      const rows = itens.map((it) => ({
        live_compra_id: id,
        produto_id: it.produtoId ?? null,
        // colunas legadas NOT NULL
        nome: it.nomeProduto,
        preco_unit: it.precoUnitario,
        qtd: it.quantidade,
        // colunas novas usadas pela UI
        nome_produto: it.nomeProduto,
        quantidade: it.quantidade,
        preco_unitario: it.precoUnitario,
        desconto_item: it.descontoItem ?? 0,
        eh_live: it.ehLive !== false,
      }))
      const { error: errItens } = await this.sb.from("live_compra_itens").insert(rows)
      if (errItens) throw new Error(errItens.message)
    }

    return { id }
  }

  async salvarPagamento(compraId: number, dados: { url: string; paymentId: string }): Promise<void> {
    const { error } = await this.sb
      .from("live_compras")
      .update({
        link_pagamento: dados.url,
        asaas_payment_id: dados.paymentId,
        pagamento_status: "EM_ABERTO",
      })
      .eq("id", compraId)
    if (error) throw new Error(error.message)
  }

  async dadosCliente(clienteId: number): Promise<DadosCliente | null> {
    const { data, error } = await this.sb
      .from("clientes")
      .select("nome, celular, cpf_cnpj")
      .eq("id", clienteId)
      .single()
    if (error || !data) return null
    return {
      nome: (data.nome as string) ?? null,
      whatsapp: (data.celular as string) ?? null,
      cpf: (data.cpf_cnpj as string) ?? null,
    }
  }

  async listarPendentes(liveId: number): Promise<PendenteComPagamento[]> {
    const { data, error } = await this.sb
      .from("live_compras")
      .select("id, asaas_payment_id")
      .eq("live_id", liveId)
      .neq("pagamento_status", "PAGO")
      .not("link_pagamento", "is", null)
    if (error || !data) return []
    return data.map((r) => ({
      id: r.id as number,
      asaasPaymentId: (r.asaas_payment_id as string) ?? null,
    }))
  }

  async marcarPago(compraId: number): Promise<void> {
    const { error } = await this.sb
      .from("live_compras")
      .update({ pagamento_status: "PAGO" })
      .eq("id", compraId)
    if (error) throw new Error(error.message)
  }
}
