// ══════════════════════════════════════════════════════════════════
// Result<T, E> — sucesso ou falha tipados, sem lançar exceções.
// Núcleo de domínio: ZERO dependência de Next/React/Supabase.
// ══════════════════════════════════════════════════════════════════
import type { DomainError } from "./domain-error"

export type Result<T, E extends DomainError = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E extends DomainError>(error: E): Result<never, E> {
  return { ok: false, error }
}

/** Retorna o primeiro erro de uma lista de Results, ou null se todos ok. */
export function primeiroErro(resultados: ReadonlyArray<Result<unknown>>): DomainError | null {
  for (const r of resultados) if (!r.ok) return r.error
  return null
}
