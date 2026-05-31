// ══════════════════════════════════════════════════════════════════
// CriarVendaUseCase — orquestra a criação de uma venda:
//   1. monta/valida a entidade Venda (regras de domínio);
//   2. valida estoque disponível dos itens controlados;
//   3. delega a persistência atômica ao repositório.
// Não conhece HTTP nem Supabase — testável com fakes.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "@/domain/shared/result"
import { Venda, type VendaInput } from "@/domain/vendas/venda"
import { EstoqueInsuficienteError } from "@/domain/vendas/errors"
import type { IVendaRepository, EstoqueReader, VendaPersistida } from "./ports"

export type CriarVendaInput = VendaInput

export class CriarVendaUseCase {
  constructor(
    private readonly vendas: IVendaRepository,
    private readonly estoque: EstoqueReader,
  ) {}

  async execute(input: CriarVendaInput): Promise<Result<VendaPersistida>> {
    const vendaResult = Venda.criar(input)
    if (!vendaResult.ok) return vendaResult
    const venda = vendaResult.value

    // Validação de estoque (defesa de negócio; a atomicidade final fica no repo)
    for (const item of venda.itensControlados()) {
      const disponivel = await this.estoque.disponivel(item.produtoId as number)
      if (disponivel !== null && item.quantidade.valor > disponivel) {
        return err(new EstoqueInsuficienteError(item.nome, disponivel, item.quantidade.valor))
      }
    }

    const persistida = await this.vendas.criar(venda)
    return ok(persistida)
  }
}
