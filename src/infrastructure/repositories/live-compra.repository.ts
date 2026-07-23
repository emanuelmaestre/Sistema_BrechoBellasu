import type { SupabaseClient } from "@supabase/supabase-js"
import type { DadosCliente, ILiveCompraRepository, ItemCompraInput } from "@/application/live/ports"
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
        nome: it.nomeProduto,
        preco_unit: it.precoUnitario,
        qtd: it.quantidade,
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
}
