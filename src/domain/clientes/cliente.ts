// ══════════════════════════════════════════════════════════════════
// Cliente — entidade. Nome obrigatório; CPF/CNPJ e e-mail validados
// quando preenchidos (reutilizando os Value Objects compartilhados).
// Campos de texto são normalizados (trim → null quando vazio).
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "../shared/result"
import { ValidacaoError } from "../shared/domain-error"
import { CpfCnpj } from "../shared/cpf-cnpj"
import { Email } from "../shared/email"

export interface ClienteInput {
  nome: string
  apelido?: string | null
  cpfCnpj?: string | null
  email?: string | null
  dataNasc?: string | null
  celular?: string | null
  instagram?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  // Endereço de entrega alternativo (opcional)
  entregaCep?: string | null
  entregaLogradouro?: string | null
  entregaNumero?: string | null
  entregaComplemento?: string | null
  entregaBairro?: string | null
  entregaCidade?: string | null
  entregaEstado?: string | null
}

const norm = (v?: string | null): string | null => {
  const t = (v ?? "").toString().trim()
  return t ? t : null
}

export class Cliente {
  private constructor(
    readonly nome: string,
    readonly apelido: string | null,
    readonly cpfCnpj: string | null,
    readonly email: string | null,
    readonly dataNasc: string | null,
    readonly celular: string | null,
    readonly instagram: string | null,
    readonly cep: string | null,
    readonly logradouro: string | null,
    readonly numero: string | null,
    readonly complemento: string | null,
    readonly bairro: string | null,
    readonly cidade: string | null,
    readonly estado: string | null,
    readonly entregaCep: string | null,
    readonly entregaLogradouro: string | null,
    readonly entregaNumero: string | null,
    readonly entregaComplemento: string | null,
    readonly entregaBairro: string | null,
    readonly entregaCidade: string | null,
    readonly entregaEstado: string | null,
  ) {}

  static criar(input: ClienteInput): Result<Cliente> {
    const nome = (input.nome ?? "").trim()
    if (!nome) return err(new ValidacaoError("O nome da cliente é obrigatório."))

    let cpfCnpj: string | null = null
    if (norm(input.cpfCnpj)) {
      const r = CpfCnpj.criar(String(input.cpfCnpj))
      if (!r.ok) return r
      cpfCnpj = r.value.valor
    }

    let email: string | null = null
    if (norm(input.email)) {
      const r = Email.criar(String(input.email))
      if (!r.ok) return r
      email = r.value.valor
    }

    let estado: string | null = norm(input.estado)
    if (estado) {
      estado = estado.toUpperCase()
      if (estado.length !== 2) return err(new ValidacaoError("Estado inválido. Use a sigla com 2 letras (ex: SP, RJ, MG)."))
    }

    let entregaEstado: string | null = norm(input.entregaEstado)
    if (entregaEstado) {
      entregaEstado = entregaEstado.toUpperCase()
      if (entregaEstado.length !== 2) return err(new ValidacaoError("Estado do endereço de entrega inválido. Use a sigla com 2 letras (ex: SP, RJ, MG)."))
    }

    return ok(
      new Cliente(
        nome,
        norm(input.apelido),
        cpfCnpj,
        email,
        norm(input.dataNasc),
        norm(input.celular),
        norm(input.instagram),
        norm(input.cep),
        norm(input.logradouro),
        norm(input.numero),
        norm(input.complemento),
        norm(input.bairro),
        norm(input.cidade),
        estado,
        norm(input.entregaCep),
        norm(input.entregaLogradouro),
        norm(input.entregaNumero),
        norm(input.entregaComplemento),
        norm(input.entregaBairro),
        norm(input.entregaCidade),
        entregaEstado,
      ),
    )
  }
}
