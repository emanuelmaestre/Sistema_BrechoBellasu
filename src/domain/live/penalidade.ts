export type MotivoPenalidade = "nao_pagou_prazo" | "desistiu_apos_contemplar"
export type StatusPenalidade = "ativa" | "removida"
export type GrauPenalidade   = "normal" | "advertida" | "restrita" | "bloqueada"

export const PENALIDADE_TEXTO_MAX = 1_000

const MOTIVOS_PENALIDADE = new Set<MotivoPenalidade>([
  "nao_pagou_prazo",
  "desistiu_apos_contemplar",
])

export function parsePenalidadeId(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export function parseMotivoPenalidade(value: unknown): MotivoPenalidade | null {
  return typeof value === "string" &&
    MOTIVOS_PENALIDADE.has(value as MotivoPenalidade)
    ? value as MotivoPenalidade
    : null
}

export function normalizePenalidadeText(
  value: unknown
): { valid: boolean; value: string | null } {
  if (value === undefined || value === null) {
    return { valid: true, value: null }
  }
  if (typeof value !== "string") {
    return { valid: false, value: null }
  }

  const normalized = value.trim()
  if (normalized.length > PENALIDADE_TEXTO_MAX) {
    return { valid: false, value: null }
  }
  return { valid: true, value: normalized || null }
}

export interface Penalidade {
  id: number
  cliente_id: number
  live_id?: number | null
  live_titulo?: string | null
  motivo: MotivoPenalidade
  observacao?: string | null
  status: StatusPenalidade
  motivo_remocao?: string | null
  criado_por_id?: number | null
  criado_por_nome?: string | null
  removido_por_id?: number | null
  removido_por_nome?: string | null
  created_at: string
  removido_em?: string | null
}

export function grauPenalidade(total: number): GrauPenalidade {
  if (total <= 0) return "normal"
  if (total === 1) return "advertida"
  if (total === 2) return "restrita"
  return "bloqueada"
}

export function podeContemplaR(total: number): boolean {
  return total < 3
}
