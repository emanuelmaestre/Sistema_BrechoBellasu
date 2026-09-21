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
  /** Persiste a venda atomicamente (venda + itens). */
  criar(venda: Venda): Promise<VendaPersistida>
  /** Cancela a venda. */
  cancelar(id: number): Promise<void>
}
