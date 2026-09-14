// ══════════════════════════════════════════════════════════════════
// Regras do REENVIO da cobrança de uma compra da live.
//
// Pode reenviar quando a mensagem já foi enviada, a compra ainda não foi
// paga e ainda há valor a pagar. Um intervalo mínimo desde o último envio
// evita cobrança repetida por engano (dois cliques, dois aparelhos).
// Função pura e testável — não toca no banco.
// ══════════════════════════════════════════════════════════════════

export const INTERVALO_MIN_REENVIO_MS = 10 * 60_000

export interface CompraReenvio {
  msg_status?: string | null
  pagamento_status?: string | null
  valor_total?: number | string | null
  desconto?: number | string | null
  credito_aplicado?: number | string | null
  msg_enviada_em?: string | null
}

const num = (v: unknown) => parseFloat(String(v ?? 0)) || 0

export function valorAPagar(c: CompraReenvio): number {
  return Math.max(0, num(c.valor_total) - num(c.desconto) - num(c.credito_aplicado))
}

/** Compra entra na lista de reenvio (sem olhar o intervalo de tempo). */
export function elegivelReenvio(c: CompraReenvio): boolean {
  return c.msg_status === "enviada" && c.pagamento_status !== "PAGO" && valorAPagar(c) > 0
}

export function podeReenviar(c: CompraReenvio, agora = Date.now()): { ok: true } | { ok: false; motivo: string } {
  if (c.msg_status !== "enviada") return { ok: false, motivo: "A cobrança ainda não foi enviada — use o disparo normal." }
  if (c.pagamento_status === "PAGO") return { ok: false, motivo: "Compra já está paga." }
  if (valorAPagar(c) <= 0) return { ok: false, motivo: "Não há valor a pagar." }
  if (c.msg_enviada_em) {
    const decorrido = agora - new Date(c.msg_enviada_em).getTime()
    if (decorrido < INTERVALO_MIN_REENVIO_MS) {
      const faltam = Math.ceil((INTERVALO_MIN_REENVIO_MS - decorrido) / 60_000)
      return { ok: false, motivo: `Enviada há pouco. Aguarde ${faltam} min para reenviar.` }
    }
  }
  return { ok: true }
}
