// ══════════════════════════════════════════════════════════════════
// Presenter de erros — borda HTTP. Traduz DomainError (do núcleo) em
// status + corpo HTTP. É a ÚNICA camada que conhece os dois mundos.
// Não importa Next: devolve dados crus que o route handler serializa.
// ══════════════════════════════════════════════════════════════════
import { DomainError, type ErrorKind } from "@/domain/shared/domain-error"

const STATUS_POR_KIND: Record<ErrorKind, number> = {
  validacao: 400,
  nao_encontrado: 404,
  conflito: 409,
  regra: 422,
}

export interface ErroHttp {
  status: number
  body: { erro: string; codigo: string }
}

/** Mapeia um DomainError para status + corpo. Erros desconhecidos → 500 genérico. */
export function apresentarErro(error: unknown): ErroHttp {
  if (error instanceof DomainError) {
    return {
      status: STATUS_POR_KIND[error.kind],
      body: { erro: error.message, codigo: error.code },
    }
  }
  // Erro de infraestrutura/inesperado: nunca vaza detalhes internos.
  return { status: 500, body: { erro: "Erro interno.", codigo: "INTERNO" } }
}
