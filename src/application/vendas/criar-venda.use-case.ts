// ══════════════════════════════════════════════════════════════════
// CriarVendaUseCase — orquestra a criação de uma venda:
//   1. monta/valida a entidade Venda (regras de domínio);
//   2. delega a persistência atômica ao repositório.
// Não conhece HTTP nem Supabase — testável com fakes.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok } from "@/domain/shared/result"
import { Venda, type VendaInput } from "@/domain/vendas/venda"
import type { IVendaRepository, VendaPersistida } from "./ports"

export type CriarVendaInput = VendaInput

export class CriarVendaUseCase {
  constructor(private readonly vendas: IVendaRepository) {}

  async execute(input: CriarVendaInput): Promise<Result<VendaPersistida>> {
    const vendaResult = Venda.criar(input)
    if (!vendaResult.ok) return vendaResult
    const venda = vendaResult.value

    const persistida = await this.vendas.criar(venda)
    return ok(persistida)
  }
}
