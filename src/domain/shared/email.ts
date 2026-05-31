// ══════════════════════════════════════════════════════════════════
// Email — Value Object. Normaliza (trim + lowercase) e valida formato.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "./result"
import { ValidacaoError } from "./domain-error"

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class Email {
  private constructor(readonly valor: string) {}

  static criar(raw: string): Result<Email> {
    const v = (raw ?? "").trim().toLowerCase()
    if (!RE_EMAIL.test(v)) return err(new ValidacaoError("E-mail inválido."))
    return ok(new Email(v))
  }
}
