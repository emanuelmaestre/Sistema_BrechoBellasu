export interface RegraParcelamento {
  maxSemJuros: number
  label: string
  avisoSemJuros: string
  avisoComJuros: string
  descricaoLink: string
}

export function calcularValorFinal(
  valorTotal: number,
  desconto?: number | null,
  creditoAplicado?: number | null,
): number {
  return Math.max(0, valorTotal - (desconto ?? 0) - (creditoAplicado ?? 0))
}

export function regraParcelamento(valorFinal: number): RegraParcelamento {
  if (valorFinal < 150) {
    return {
      maxSemJuros: 0,
      label: "Sem parcelamento sem juros",
      avisoSemJuros: "Esta compra nao se enquadra na regra de parcelamento sem juros.",
      avisoComJuros: "Qualquer parcelamento tera juros repassados a cliente.",
      descricaoLink: "Parcelamento com juros repassados a cliente.",
    }
  }
  if (valorFinal < 300) {
    return {
      maxSemJuros: 2,
      label: "Ate 2x sem juros",
      avisoSemJuros: "Esta compra permite ate 2x sem juros.",
      avisoComJuros: "A partir de 3x, os juros serao repassados a cliente.",
      descricaoLink: "Ate 2x sem juros. A partir de 3x, juros repassados a cliente.",
    }
  }
  return {
    maxSemJuros: 3,
    label: "Ate 3x sem juros",
    avisoSemJuros: "Esta compra permite ate 3x sem juros.",
    avisoComJuros: "A partir de 4x, os juros serao repassados a cliente.",
    descricaoLink: "Ate 3x sem juros. A partir de 4x, juros repassados a cliente.",
  }
}

export function corRegraParcelamento(maxSemJuros: number): string {
  if (maxSemJuros === 0) return "#f87171"
  if (maxSemJuros === 2) return "#fbbf24"
  return "#34d399"
}

export function avisoParcelamento(parcelas: number, regra: RegraParcelamento): string {
  if (parcelas <= 1) return "A vista - sem juros."
  if (parcelas <= regra.maxSemJuros) return `${parcelas}x sem juros.`
  if (regra.maxSemJuros === 0) return "A partir de 2x, os juros sao repassados a cliente."
  return `A partir de ${regra.maxSemJuros + 1}x, os juros sao repassados a cliente.`
}
