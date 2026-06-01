// Erros de domínio do módulo de Vendas — tipados e distintos de erros de infra.
import { DomainError } from "../shared/domain-error"

export class VendaSemItensError extends DomainError {
  readonly code = "VENDA_SEM_ITENS"
  readonly kind = "regra" as const
  constructor() {
    super("Adicione pelo menos um produto antes de finalizar a venda.")
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
    super(
      disponivel === 0
        ? `O produto "${produto}" está sem estoque disponível.`
        : `Estoque insuficiente para "${produto}": há ${disponivel} disponível, mas foram solicitados ${solicitado}.`
    )
  }
}
