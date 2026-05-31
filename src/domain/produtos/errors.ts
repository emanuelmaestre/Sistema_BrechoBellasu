import { DomainError } from "../shared/domain-error"

export class EstoqueNegativoError extends DomainError {
  readonly code = "ESTOQUE_NEGATIVO"
  readonly kind = "regra" as const
  constructor(resultado: number) {
    super(`A operação deixaria o estoque negativo (${resultado}).`)
  }
}

export class ProdutoNaoEncontradoError extends DomainError {
  readonly code = "PRODUTO_NAO_ENCONTRADO"
  readonly kind = "nao_encontrado" as const
  constructor() {
    super("Produto não encontrado.")
  }
}

export class CodigoDuplicadoError extends DomainError {
  readonly code = "CODIGO_DUPLICADO"
  readonly kind = "conflito" as const
  constructor() {
    super("Código já existe.")
  }
}
