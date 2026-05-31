// ══════════════════════════════════════════════════════════════════
// Money — Value Object monetário. Armazena CENTAVOS inteiros para
// eliminar erros de ponto flutuante (ex: 0.1 + 0.2 !== 0.3).
// Imutável. Toda aritmética monetária do sistema passa por aqui.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "./result"
import { ValidacaoError } from "./domain-error"

export class Money {
  private constructor(public readonly centavos: number) {}

  /** Cria a partir de reais (ex: 19.9 → 1990 centavos). Arredonda ao centavo. */
  static deReais(reais: number): Result<Money> {
    if (typeof reais !== "number" || !Number.isFinite(reais)) {
      return err(new ValidacaoError("Valor monetário inválido."))
    }
    return ok(new Money(Math.round(reais * 100)))
  }

  /** Cria a partir de centavos inteiros. */
  static deCentavos(centavos: number): Result<Money> {
    if (!Number.isInteger(centavos)) {
      return err(new ValidacaoError("Centavos devem ser um inteiro."))
    }
    return ok(new Money(centavos))
  }

  static readonly ZERO = new Money(0)

  get reais(): number {
    return this.centavos / 100
  }

  somar(outro: Money): Money {
    return new Money(this.centavos + outro.centavos)
  }

  subtrair(outro: Money): Money {
    return new Money(this.centavos - outro.centavos)
  }

  /** Multiplica por uma quantidade inteira (ex: preço unitário × qtd). */
  multiplicarPor(fator: number): Money {
    return new Money(Math.round(this.centavos * fator))
  }

  /** Nunca abaixo de zero — útil para total após desconto. */
  clampNaoNegativo(): Money {
    return this.centavos < 0 ? Money.ZERO : this
  }

  ehNegativo(): boolean {
    return this.centavos < 0
  }

  maiorQue(outro: Money): boolean {
    return this.centavos > outro.centavos
  }

  equals(outro: Money): boolean {
    return this.centavos === outro.centavos
  }
}
