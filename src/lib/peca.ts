// Helpers do cadastro de peça digitada na hora (live e vendas).

/** "1.234,50" → 1234.5. Vazio ou inválido → 0. */
export function parsePrecoBR(valor: string | number | null | undefined): number {
  const n = parseFloat(String(valor ?? "").replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

/** 1234.5 → "1.234,50" (mesmo formato que o campo mostra ao sair dele). */
export function formatarPrecoBR(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
}

/** Desconto em % entre o preço original e o praticado; 0 quando não há desconto. */
export function descontoPct(original: number, praticado: number): number {
  if (!original || !praticado || praticado >= original) return 0
  return Math.round((1 - praticado / original) * 100)
}

/** Nome que vai para a venda/recibo: "VESTIDO MIDI - AZUL" quando há cor. */
export function nomeComCor(nome: string, cor: string): string {
  const n = nome.trim().replace(/\s+/g, " ")
  const c = cor.trim().toUpperCase()
  return c ? `${n} - ${c}` : n
}
