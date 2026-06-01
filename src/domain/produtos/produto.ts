// ══════════════════════════════════════════════════════════════════
// Produto — entidade. Invariantes: nome obrigatório, preços ≥ 0,
// estoque inteiro ≥ 0. Preços via Money (sem float).
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "../shared/result"
import { ValidacaoError } from "../shared/domain-error"
import { Money } from "../shared/money"

export interface ProdutoInput {
  nome: string
  codigo?: string | null
  categoriaId?: number | null
  marca?: string | null
  precoVenda: number
  precoCusto?: number | null
  estoqueAtual?: number
  controlarEstoque?: boolean
  unidadeMedida?: string | null
  cor?: string | null
}

export class Produto {
  private constructor(
    readonly nome: string,
    readonly codigo: string | null,
    readonly categoriaId: number | null,
    readonly marca: string | null,
    readonly precoVenda: Money,
    readonly precoCusto: Money,
    readonly estoqueAtual: number,
    readonly controlarEstoque: boolean,
    readonly unidadeMedida: string,
    readonly cor: string | null,
  ) {}

  static criar(input: ProdutoInput): Result<Produto> {
    const nome = (input.nome ?? "").trim()
    if (!nome) return err(new ValidacaoError("Informe o nome do produto antes de salvar."))

    const precoVenda = Money.deReais(input.precoVenda ?? 0)
    if (!precoVenda.ok) return precoVenda
    if (precoVenda.value.ehNegativo()) {
      return err(new ValidacaoError("O preço de venda não pode ser negativo."))
    }

    const precoCusto = Money.deReais(input.precoCusto ?? 0)
    if (!precoCusto.ok) return precoCusto
    if (precoCusto.value.ehNegativo()) {
      return err(new ValidacaoError("O preço de custo não pode ser negativo."))
    }

    const estoque = input.estoqueAtual ?? 0
    if (!Number.isInteger(estoque) || estoque < 0) {
      return err(new ValidacaoError("A quantidade em estoque deve ser um número inteiro e não pode ser negativa."))
    }

    return ok(
      new Produto(
        nome,
        input.codigo ?? null,
        input.categoriaId ?? null,
        input.marca ?? null,
        precoVenda.value,
        precoCusto.value,
        estoque,
        input.controlarEstoque !== false,
        input.unidadeMedida || "un",
        input.cor?.trim() || null,
      ),
    )
  }
}
