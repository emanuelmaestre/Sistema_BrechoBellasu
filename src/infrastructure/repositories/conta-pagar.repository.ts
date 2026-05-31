// ══════════════════════════════════════════════════════════════════
// ContaPagarRepositorySupabase — implementação de IContaPagarRepository.
// Usa a coluna REAL `pago_em` (o código antigo gravava `data_pagamento`,
// que não existe).
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type { IContaPagarRepository } from "@/application/financeiro/ports"
import type { ContaPagar } from "@/domain/financeiro/conta-pagar"

export class ContaPagarRepositorySupabase implements IContaPagarRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async criar(conta: ContaPagar): Promise<{ id: number }> {
    const { data, error } = await this.sb
      .from("contas_pagar")
      .insert({
        descricao: conta.descricao,
        valor: conta.valor.reais,
        vencimento: conta.vencimento,
        categoria: conta.categoria,
      })
      .select("id")
      .single()
    if (error) throw new Error(error.message)
    return { id: data.id as number }
  }

  async marcarPago(id: number, pagoEm: string): Promise<void> {
    const { error } = await this.sb
      .from("contas_pagar")
      .update({ status: "pago", pago_em: pagoEm })
      .eq("id", id)
    if (error) throw new Error(error.message)
  }
}
