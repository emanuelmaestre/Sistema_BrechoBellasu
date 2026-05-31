// ══════════════════════════════════════════════════════════════════
// TrocaRepositorySupabase — implementação de ITrocaRepository.
// Update de status feito direto (o RPC fn_atualizar_status_troca tinha
// assinatura incompatível com a chamada — 4 args vs 2). Depende da
// migration 011 (colunas reconciliadas + CHECK de status removido).
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ITrocaRepository } from "@/application/trocas/ports"
import type { Troca } from "@/domain/trocas/troca"

export class TrocaRepositorySupabase implements ITrocaRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async criar(troca: Troca, responsavelId: number): Promise<{ id: number }> {
    const { data, error } = await this.sb
      .from("trocas")
      .insert({
        tipo: troca.tipo,
        motivo: troca.motivo,
        status: troca.status,
        venda_id: troca.vendaId,
        cliente_id: troca.clienteId,
        cliente_nome: troca.clienteNome,
        produto_id: troca.produtoId,
        nome_produto: troca.nomeProduto,
        quantidade: troca.quantidade,
        responsavel_id: responsavelId,
        observacoes: troca.observacoes,
      })
      .select("id")
      .single()
    if (error) throw new Error(error.message)
    return { id: data.id as number }
  }

  async atualizarStatus(
    id: number,
    status: string,
    decisaoProduto?: string | null,
    resultadoFin?: string | null,
  ): Promise<void> {
    const campos: Record<string, unknown> = { status }
    if (decisaoProduto != null) campos.decisao_produto = decisaoProduto
    if (resultadoFin != null) campos.resultado_fin = resultadoFin

    const { error } = await this.sb.from("trocas").update(campos).eq("id", id)
    if (error) throw new Error(error.message)
  }
}
