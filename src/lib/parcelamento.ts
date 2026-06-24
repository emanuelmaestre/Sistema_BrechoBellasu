// ──────────────────────────────────────────────────────────────
// Regras de parcelamento sem juros — Live Brechó Bellasu
// Aplicadas na criação do link Asaas e na UI de disparo.
// A regra SEMPRE considera o valor final (após créditos/descontos).
// ──────────────────────────────────────────────────────────────

export interface RegraParcelamento {
  maxSemJuros: number      // 0 = nenhuma parcela sem juros
  label: string            // ex: "Até 2x sem juros"
  avisoSemJuros: string    // mensagem para o operador
  avisoComJuros: string    // mensagem sobre quando os juros entram
  descricaoLink: string    // texto incluído na descrição do link Asaas
}

/** Calcula o valor final a pagar considerando descontos e créditos aplicados. */
export function calcularValorFinal(
  valorTotal: number,
  desconto?: number | null,
  creditoAplicado?: number | null,
): number {
  return Math.max(0, valorTotal - (desconto ?? 0) - (creditoAplicado ?? 0))
}

/**
 * Determina a regra de parcelamento sem juros com base no valor FINAL a pagar.
 * Faixas:
 *   < R$ 150,00   → sem parcelamento sem juros
 *   R$ 150–299,99 → até 2x sem juros
 *   ≥ R$ 300,00   → até 3x sem juros
 *   ≥ 4x          → sempre com juros repassados
 */
export function regraParcelamento(valorFinal: number): RegraParcelamento {
  if (valorFinal < 150) {
    return {
      maxSemJuros: 0,
      label: "Sem parcelamento sem juros",
      avisoSemJuros: "Esta compra não se enquadra na regra de parcelamento sem juros.",
      avisoComJuros: "Qualquer parcelamento terá juros repassados à cliente conforme o Asaas.",
      descricaoLink: "Parcelamento com juros repassados à cliente.",
    }
  }
  if (valorFinal < 300) {
    return {
      maxSemJuros: 2,
      label: "Até 2x sem juros",
      avisoSemJuros: "Esta compra permite até 2x sem juros.",
      avisoComJuros: "A partir de 3x, os juros serão repassados à cliente.",
      descricaoLink: "Até 2x sem juros. A partir de 3x, juros repassados à cliente.",
    }
  }
  return {
    maxSemJuros: 3,
    label: "Até 3x sem juros",
    avisoSemJuros: "Esta compra permite até 3x sem juros.",
    avisoComJuros: "A partir de 4x, os juros serão repassados à cliente.",
    descricaoLink: "Até 3x sem juros. A partir de 4x, juros repassados à cliente.",
  }
}

export function corRegraParcelamento(maxSemJuros: number): string {
  if (maxSemJuros === 0) return "#f87171"
  if (maxSemJuros === 2) return "#fbbf24"
  return "#34d399"
}

/** Texto explicativo para uma quantidade de parcelas escolhida. */
export function avisoParcelamento(parcelas: number, regra: RegraParcelamento): string {
  if (parcelas <= 1) return "À vista — sem juros."
  if (parcelas <= regra.maxSemJuros) return `${parcelas}x sem juros. ✅`
  if (regra.maxSemJuros === 0) return `A partir de 2x, os juros são repassados à cliente.`
  return `A partir de ${regra.maxSemJuros + 1}x, os juros são repassados à cliente.`
}
