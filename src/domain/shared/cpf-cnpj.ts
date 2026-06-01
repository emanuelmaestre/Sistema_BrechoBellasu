// ══════════════════════════════════════════════════════════════════
// CpfCnpj — Value Object de documento brasileiro (CPF ou CNPJ).
// Valida os dígitos verificadores. Armazena apenas dígitos.
// Reutilizável por clientes, lives, integração de pagamento, etc.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "./result"
import { ValidacaoError } from "./domain-error"

function validarCpf(d: string): boolean {
  if (/^(\d)\1{10}$/.test(d)) return false // todos iguais
  let soma = 0
  for (let i = 0; i < 9; i++) soma += Number(d[i]) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== Number(d[9])) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += Number(d[i]) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  return resto === Number(d[10])
}

function validarCnpj(d: string): boolean {
  if (/^(\d)\1{13}$/.test(d)) return false
  const calc = (len: number): number => {
    const pesos =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let soma = 0
    for (let i = 0; i < len; i++) soma += Number(d[i]) * pesos[i]
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

export class CpfCnpj {
  /** Apenas dígitos (sem máscara). */
  private constructor(readonly valor: string) {}

  static criar(raw: string): Result<CpfCnpj> {
    const digitos = (raw ?? "").replace(/\D/g, "")
    if (digitos.length === 11) {
      if (!validarCpf(digitos)) return err(new ValidacaoError("CPF inválido. Verifique os números digitados."))
    } else if (digitos.length === 14) {
      if (!validarCnpj(digitos)) return err(new ValidacaoError("CNPJ inválido. Verifique os números digitados."))
    } else {
      return err(new ValidacaoError("CPF deve ter 11 dígitos e CNPJ 14 dígitos."))
    }
    return ok(new CpfCnpj(digitos))
  }

  get ehCnpj(): boolean {
    return this.valor.length === 14
  }
}
