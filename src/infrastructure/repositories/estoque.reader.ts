// ══════════════════════════════════════════════════════════════════
// EstoqueReaderSupabase — implementação concreta de EstoqueReader.
// Lê estoque_atual de produtos que controlam estoque.
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type { EstoqueReader } from "@/application/vendas/ports"

export class EstoqueReaderSupabase implements EstoqueReader {
  constructor(private readonly sb: SupabaseClient) {}

  async disponivel(produtoId: number): Promise<number | null> {
    const { data, error } = await this.sb
      .from("produtos")
      .select("estoque_atual, controlar_estoque")
      .eq("id", produtoId)
      .single()

    if (error || !data) return null
    // null = "não validar" (produto avulso ou que não controla estoque)
    if (!data.controlar_estoque) return null
    return Number(data.estoque_atual)
  }
}
