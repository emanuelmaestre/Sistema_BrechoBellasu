import { DomainError } from "../shared/domain-error"

export class CompraNaoEncontradaError extends DomainError {
  readonly code = "COMPRA_NAO_ENCONTRADA"
  readonly kind = "nao_encontrado" as const
  constructor() {
    super("Compra não encontrada. Ela pode ter sido removida.")
  }
}

export class FinalizacaoInvalidaError extends DomainError {
  readonly code = "FINALIZACAO_INVALIDA"
  readonly kind = "regra" as const
  constructor(message: string) {
    super(message)
  }
}
