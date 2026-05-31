// ══════════════════════════════════════════════════════════════════
// ContaReceber — entidade de conta a receber. Valor via Money (> 0),
// descrição e vencimento obrigatórios; cliente opcional.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "../shared/result"
import { ValidacaoError } from "../shared/domain-error"
import { Money } from "../shared/money"

export interface ContaReceberInput {
  descricao: string
  valor: number
  vencimento: string
  clienteId?: number | null
}

export class ContaReceber {
  private constructor(
    readonly descricao: string,
    readonly valor: Money,
    readonly vencimento: string,
    readonly clienteId: number | null,
  ) {}

  static criar(input: ContaReceberInput): Result<ContaReceber> {
    const descricao = (input.descricao ?? "").trim()
    if (!descricao) return err(new ValidacaoError("Descrição é obrigatória."))

    const valor = Money.deReais(input.valor)
    if (!valor.ok) return valor
    if (valor.value.centavos <= 0) {
      return err(new ValidacaoError("Valor deve ser positivo."))
    }

    const vencimento = (input.vencimento ?? "").trim()
    if (!vencimento) return err(new ValidacaoError("Vencimento é obrigatório."))

    return ok(new ContaReceber(descricao, valor.value, vencimento, input.clienteId ?? null))
  }
}
