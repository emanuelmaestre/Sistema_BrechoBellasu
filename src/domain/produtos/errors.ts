import { DomainError } from "../shared/domain-error"

export class EstoqueNegativoError extends DomainError {
  readonly code = "ESTOQUE_NEGATIVO"
  readonly kind = "regra" as const
  constructor(resultado: number) {
    super(`Não é possível realizar essa operação: o estoque ficaria com saldo negativo (${Math.abs(resultado)} unidades a menos do que o disponível).`)
  }
}

export class ProdutoNaoEncontradoError extends DomainError {
  readonly code = "PRODUTO_NAO_ENCONTRADO"
  readonly kind = "nao_encontrado" as const
  constructor() {
    super("Produto não encontrado. Ele pode ter sido removido.")
  }
}

export class CodigoDuplicadoError extends DomainError {
  readonly code = "CODIGO_DUPLICADO"
  readonly kind = "conflito" as const
  constructor() {
    super("Já existe outro produto com este código. Use um código diferente.")
  }
}
