// ══════════════════════════════════════════════════════════════════
// Quantidade — Value Object de quantidade inteira positiva (≥ 1).
// Usada em itens de venda. Imutável.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "./result"
import { ValidacaoError } from "./domain-error"

export class Quantidade {
  private constructor(public readonly valor: number) {}

  static criar(valor: number): Result<Quantidade> {
    if (!Number.isInteger(valor)) {
      return err(new ValidacaoError("Quantidade deve ser um número inteiro."))
    }
    if (valor < 1) {
      return err(new ValidacaoError("Quantidade deve ser ao menos 1."))
    }
    return ok(new Quantidade(valor))
  }

  equals(outra: Quantidade): boolean {
    return this.valor === outra.valor
  }
}
