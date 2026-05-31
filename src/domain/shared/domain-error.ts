// ══════════════════════════════════════════════════════════════════
// DomainError — erro de negócio tipado. Distinto de erros de
// infraestrutura (rede, banco). O `kind` permite que a camada de
// apresentação mapeie para um status HTTP SEM o domínio conhecer HTTP.
// ══════════════════════════════════════════════════════════════════

/** Categoria do erro — usada apenas para mapear status na borda HTTP. */
export type ErrorKind =
  | "validacao" // entrada inválida           → 400/422
  | "nao_encontrado" // recurso inexistente    → 404
  | "conflito" // viola invariante/concorrência → 409
  | "regra" // regra de negócio violada        → 422

export abstract class DomainError extends Error {
  /** Código estável e legível por máquina (ex: "ESTOQUE_INSUFICIENTE"). */
  abstract readonly code: string
  /** Categoria para mapeamento na borda (nunca acoplada a HTTP aqui). */
  abstract readonly kind: ErrorKind

  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** Erro genérico de validação de entrada/value-object. */
export class ValidacaoError extends DomainError {
  readonly code = "VALIDACAO"
  readonly kind = "validacao" as const
}
