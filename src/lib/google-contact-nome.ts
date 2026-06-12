// Módulo puro — sem dependências de servidor. Seguro para importar no browser.

/** Formata o handle do Instagram: remove @s extras, adiciona um @, maiúsculas */
export function formatarInstagram(raw: string | null | undefined): string {
  if (!raw) return ""
  const limpo = raw.trim().replace(/^@+/, "").replace(/\s+/g, "").toUpperCase()
  return limpo ? `@${limpo}` : ""
}

/** Normaliza telefone brasileiro para E.164 sem espaços: +5516991347476 */
export function normalizarTelefone(raw: string | null | undefined): { ok: boolean; valor: string; erro?: string } {
  if (!raw) return { ok: false, valor: "", erro: "Telefone não informado." }

  const digits = raw.replace(/\D/g, "")

  // Já tem DDI 55
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return { ok: true, valor: `+${digits}` }
  }

  // Sem DDI — deve ter 10 (fixo) ou 11 (celular) dígitos
  if (digits.length === 10 || digits.length === 11) {
    return { ok: true, valor: `+55${digits}` }
  }

  return { ok: false, valor: digits, erro: `Telefone inválido (${digits.length} dígitos). Verifique o cadastro.` }
}

/**
 * Monta o nome do contato Google seguindo a regra:
 * NOME COMPLETO - APELIDO - INSTAGRAM
 * Campos ausentes são ignorados; nunca sobram traços.
 */
export function montarNomeContato(params: {
  nome?:      string | null
  instagram?: string | null
}): string {
  const partes: string[] = []

  const nome = params.nome?.trim().replace(/\s+/g, " ").toUpperCase()
  if (nome) partes.push(nome)

  const ig = formatarInstagram(params.instagram)
  if (ig) partes.push(ig)

  return partes.join(" - ")
}
