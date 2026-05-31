// ══════════════════════════════════════════════════════════════════
// VendaRepositorySupabase — implementação concreta de IVendaRepository.
// ÚNICA camada que conhece o Supabase para escrita de vendas. Delega a
// atomicidade às funções Postgres fn_criar_venda / fn_cancelar_venda
// (ver supabase/008_vendas_atomica.sql).
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type { IVendaRepository, VendaPersistida } from "@/application/vendas/ports"
import type { Venda } from "@/domain/vendas/venda"
import { EstoqueInsuficienteError } from "@/domain/vendas/errors"

export class VendaRepositorySupabase implements IVendaRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async criar(venda: Venda): Promise<VendaPersistida> {
    const itens = venda.itens.map((it) => ({
      produto_id: it.produtoId,
      nome: it.nome,
      preco_unit: it.precoUnitario.reais,
      qtd: it.quantidade.valor,
    }))

    const { data, error } = await this.sb.rpc("fn_criar_venda", {
      p_cliente_id: venda.clienteId,
      p_vendedor_id: venda.vendedorId,
      p_forma_pagamento: venda.formaPagamento,
      p_desconto: venda.desconto.reais,
      p_obs: venda.observacoes,
      p_itens: itens,
    })

    if (error) {
      // Backstop de concorrência: a função pode recusar por estoque mesmo
      // após o pré-check do use case (corrida entre vendas simultâneas).
      const m = /ESTOQUE_INSUFICIENTE:([^:]*):(\d+):(\d+)/.exec(error.message ?? "")
      if (m) throw new EstoqueInsuficienteError(m[1], Number(m[2]), Number(m[3]))
      throw new Error(error.message)
    }

    const r = data as { id: number; total: number }
    return { id: r.id, total: Number(r.total) }
  }

  async cancelar(id: number): Promise<void> {
    const { error } = await this.sb.rpc("fn_cancelar_venda", { p_id: id })
    if (error) throw new Error(error.message)
  }
}
