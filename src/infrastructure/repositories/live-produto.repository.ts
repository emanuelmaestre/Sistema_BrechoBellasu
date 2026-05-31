// ══════════════════════════════════════════════════════════════════
// LiveProdutoRepositorySupabase — implementação de ILiveProdutoRepository.
// Depende da migration 012 (live_compra_produtos + status_compra).
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ILiveProdutoRepository } from "@/application/live/ports"
import type { VinculoResumo } from "@/domain/live/status-compra"

export class LiveProdutoRepositorySupabase implements ILiveProdutoRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async quantidadeEsperada(compraId: number): Promise<number | null> {
    const { data, error } = await this.sb
      .from("live_compras")
      .select("quantidade_itens")
      .eq("id", compraId)
      .single()
    if (error || !data) return null
    return Number(data.quantidade_itens ?? 0)
  }

  async listarVinculos(compraId: number): Promise<VinculoResumo[]> {
    const { data, error } = await this.sb
      .from("live_compra_produtos")
      .select("quantidade, estoque_baixado")
      .eq("compra_id", compraId)
    if (error || !data) return []
    return data.map((r) => ({
      quantidade: Number(r.quantidade ?? 1),
      estoqueBaixado: r.estoque_baixado === true,
    }))
  }

  async definirStatusCompra(compraId: number, status: string): Promise<void> {
    const { error } = await this.sb
      .from("live_compras")
      .update({ status_compra: status })
      .eq("id", compraId)
    if (error) throw new Error(error.message)
  }
}
