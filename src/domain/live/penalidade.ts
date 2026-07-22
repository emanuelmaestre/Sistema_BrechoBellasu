export type MotivoPenalidade = "nao_pagou_prazo" | "desistiu_apos_contemplar"
export type StatusPenalidade = "ativa" | "removida"
export type GrauPenalidade   = "normal" | "advertida" | "restrita" | "bloqueada"

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

export const MOTIVO_LABEL: Record<MotivoPenalidade, string> = {
  nao_pagou_prazo:          "Não pagou no prazo",
  desistiu_apos_contemplar: "Desistiu após contemplar",
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

export const GRAU_CONFIG: Record<GrauPenalidade, { label: string; cor: string; bg: string; border: string }> = {
  normal:    { label: "Normal",    cor: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  advertida: { label: "Advertida", cor: "text-yellow-700",  bg: "bg-yellow-50",   border: "border-yellow-200" },
  restrita:  { label: "Restrita",  cor: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200" },
  bloqueada: { label: "Bloqueada", cor: "text-red-700",     bg: "bg-red-50",      border: "border-red-200"    },
}
