// ──────────────────────────────────────────────────────────────
// Regras de parcelamento sem juros — Live Brechó Bellasu
// Aplicadas visualmente no disparo e na descrição do link Asaas.
// ──────────────────────────────────────────────────────────────

export interface RegraParcelamento {
  maxSemJuros: number      // 0 = nenhuma parcela sem juros
  label: string            // ex: "Até 2x sem juros"
  avisoSemJuros: string    // mensagem para o operador
  avisoComJuros: string    // mensagem sobre quando os juros entram
  descricaoLink: string    // texto incluído na descrição do link Asaas
}

export function regraParcelamento(valor: number): RegraParcelamento {
  if (valor < 150) {
    return {
      maxSemJuros: 0,
      label: "Sem parcelamento sem juros",
      avisoSemJuros: "Esta compra não se enquadra na regra de parcelamento sem juros.",
      avisoComJuros: "Qualquer parcelamento terá juros repassados à cliente conforme o Asaas.",
      descricaoLink: "Parcelamento com juros repassados à cliente.",
    }
  }
  if (valor < 300) {
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
  if (maxSemJuros === 0) return "#f87171"   // vermelho — sem benefício
  if (maxSemJuros === 2) return "#fbbf24"   // amarelo — 2x
  return "#34d399"                           // verde — 3x
}
