// Contrato do repositório de Trocas.
import type { Troca } from "@/domain/trocas/troca"

export interface ITrocaRepository {
  criar(troca: Troca, responsavelId: number): Promise<{ id: number }>
  atualizarStatus(
    id: number,
    status: string,
    decisaoProduto?: string | null,
    resultadoFin?: string | null,
  ): Promise<void>
}
