// ══════════════════════════════════════════════════════════════════
// Troca — entidade de troca/devolução. Tipo e motivo obrigatórios.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "../shared/result"
import { ValidacaoError } from "../shared/domain-error"

export type TipoTroca = "troca" | "devolucao"

export interface TrocaInput {
  tipo: string
  motivo: string
  vendaId?: number | null
  clienteId?: number | null
  clienteNome?: string | null
  produtoId?: number | null
  nomeProduto?: string | null
  quantidade?: number
  observacoes?: string | null
  status?: string
}

const norm = (v?: string | null): string | null => {
  const t = (v ?? "").toString().trim()
  return t ? t : null
}

export class Troca {
  private constructor(
    readonly tipo: TipoTroca,
    readonly motivo: string,
    readonly status: string,
    readonly vendaId: number | null,
    readonly clienteId: number | null,
    readonly clienteNome: string | null,
    readonly produtoId: number | null,
    readonly nomeProduto: string | null,
    readonly quantidade: number,
    readonly observacoes: string | null,
  ) {}

  static criar(input: TrocaInput): Result<Troca> {
    if (input.tipo !== "troca" && input.tipo !== "devolucao") {
      return err(new ValidacaoError("Selecione o tipo: Troca ou Devolução."))
    }
    const motivo = (input.motivo ?? "").trim()
    if (!motivo) return err(new ValidacaoError("Informe o motivo da solicitação."))

    const quantidade = input.quantidade ?? 1
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      return err(new ValidacaoError("A quantidade deve ser ao menos 1."))
    }

    return ok(
      new Troca(
        input.tipo,
        motivo,
        norm(input.status) ?? "solicitado",
        input.vendaId ?? null,
        input.clienteId ?? null,
        norm(input.clienteNome),
        input.produtoId ?? null,
        norm(input.nomeProduto),
        quantidade,
        norm(input.observacoes),
      ),
    )
  }
}
