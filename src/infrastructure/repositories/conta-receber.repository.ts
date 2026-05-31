// ══════════════════════════════════════════════════════════════════
// ContaReceberRepositorySupabase — implementação de IContaReceberRepository.
// Agora registra `recebido_em` ao receber (antes só mudava o status, o que
// zerava o "recebido no mês" do resumo financeiro).
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type { IContaReceberRepository } from "@/application/financeiro/ports"
import type { ContaReceber } from "@/domain/financeiro/conta-receber"

export class ContaReceberRepositorySupabase implements IContaReceberRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async criar(conta: ContaReceber): Promise<{ id: number }> {
    const { data, error } = await this.sb
      .from("contas_receber")
      .insert({
        descricao: conta.descricao,
        valor: conta.valor.reais,
        vencimento: conta.vencimento,
        cliente_id: conta.clienteId,
      })
      .select("id")
      .single()
    if (error) throw new Error(error.message)
    return { id: data.id as number }
  }

  async marcarRecebido(id: number, recebidoEm: string): Promise<void> {
    const { error } = await this.sb
      .from("contas_receber")
      .update({ status: "recebido", recebido_em: recebidoEm })
      .eq("id", id)
    if (error) throw new Error(error.message)
  }
}
