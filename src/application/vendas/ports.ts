// ══════════════════════════════════════════════════════════════════
// Ports (contratos) do módulo de Vendas. Os use cases dependem DESTAS
// abstrações — nunca de Supabase. A infraestrutura as implementa.
// ══════════════════════════════════════════════════════════════════
import type { Venda } from "@/domain/vendas/venda"

export interface VendaPersistida {
  id: number
  total: number // em reais
}

export interface IVendaRepository {
  /** Persiste a venda atomicamente (venda + itens + baixa de estoque). */
  criar(venda: Venda): Promise<VendaPersistida>
  /** Cancela a venda e estorna o estoque. */
  cancelar(id: number): Promise<void>
}

export interface EstoqueReader {
  /**
   * Estoque disponível do produto, ou `null` quando o produto não
   * controla estoque ou não existe (nesse caso não há validação).
   */
  disponivel(produtoId: number): Promise<number | null>
}
