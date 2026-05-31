// ══════════════════════════════════════════════════════════════════
// ContaPagar — entidade de conta a pagar. Valor via Money (> 0),
// descrição e vencimento obrigatórios.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "../shared/result"
import { ValidacaoError } from "../shared/domain-error"
import { Money } from "../shared/money"

export interface ContaPagarInput {
  descricao: string
  valor: number
  vencimento: string
  categoria?: string | null
}

export class ContaPagar {
  private constructor(
    readonly descricao: string,
    readonly valor: Money,
    readonly vencimento: string,
    readonly categoria: string | null,
  ) {}

  static criar(input: ContaPagarInput): Result<ContaPagar> {
    const descricao = (input.descricao ?? "").trim()
    if (!descricao) return err(new ValidacaoError("Descrição é obrigatória."))

    const valor = Money.deReais(input.valor)
    if (!valor.ok) return valor
    if (valor.value.centavos <= 0) {
      return err(new ValidacaoError("Valor deve ser positivo."))
    }

    const vencimento = (input.vencimento ?? "").trim()
    if (!vencimento) return err(new ValidacaoError("Vencimento é obrigatório."))

    const categoria = (input.categoria ?? "").trim() || null
    return ok(new ContaPagar(descricao, valor.value, vencimento, categoria))
  }
}
