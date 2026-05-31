// Erros de domínio do módulo de Vendas — tipados e distintos de erros de infra.
import { DomainError } from "../shared/domain-error"

export class VendaSemItensError extends DomainError {
  readonly code = "VENDA_SEM_ITENS"
  readonly kind = "regra" as const
  constructor() {
    super("A venda precisa ter ao menos um item.")
  }
}

export class EstoqueInsuficienteError extends DomainError {
  readonly code = "ESTOQUE_INSUFICIENTE"
  readonly kind = "conflito" as const
  constructor(
    readonly produto: string,
    readonly disponivel: number,
    readonly solicitado: number,
  ) {
    super(`Estoque insuficiente para "${produto}": disponível ${disponivel}, solicitado ${solicitado}.`)
  }
}
