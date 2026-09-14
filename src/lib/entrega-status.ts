// ══════════════════════════════════════════════════════════════════
// Status de entrega do WhatsApp (webhook "MessageStatusCallback" da Z-API).
//
// A Z-API manda os status fora de ordem às vezes (READ antes de RECEIVED).
// Por isso o status só AVANÇA: nunca rebaixa uma mensagem já lida para
// "entregue". Função pura e testável — não toca no banco.
// ══════════════════════════════════════════════════════════════════

const ORDEM: Record<string, number> = {
  SENT: 1,
  RECEIVED: 2,
  READ: 3,
  READ_BY_ME: 3,
  PLAYED: 4,
}

/** Normaliza o status recebido da Z-API. Retorna null se desconhecido. */
export function normalizarStatusEntrega(status: unknown): string | null {
  if (typeof status !== "string") return null
  const s = status.trim().toUpperCase()
  if (s === "DELIVERED") return "RECEIVED" // formato antigo
  return s in ORDEM ? s : null
}

/** true se `novo` representa avanço em relação a `atual`. */
export function statusAvanca(atual: string | null | undefined, novo: string): boolean {
  const a = atual ? ORDEM[atual] ?? 0 : 0
  return (ORDEM[novo] ?? 0) > a
}

/** Colunas de data a preencher quando o status chega. */
export function marcosEntrega(status: string, momento: string): { entregue?: string; lida?: string } {
  const n = ORDEM[status] ?? 0
  return {
    entregue: n >= ORDEM.RECEIVED ? momento : undefined,
    lida: n >= ORDEM.READ ? momento : undefined,
  }
}
