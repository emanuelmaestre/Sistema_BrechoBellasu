// ══════════════════════════════════════════════════════════════════
// VendaItem — item de uma venda. Imutável. Calcula seu próprio subtotal
// via Money (sem float). Validado na criação.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "../shared/result"
import { ValidacaoError } from "../shared/domain-error"
import { Money } from "../shared/money"
import { Quantidade } from "../shared/quantidade"

export interface VendaItemInput {
  produtoId?: number | null
  nome: string
  quantidade: number
  precoUnitario: number // em reais
  /** Se o produto controla estoque (default: true quando há produtoId). */
  controlarEstoque?: boolean
}

export class VendaItem {
  private constructor(
    readonly produtoId: number | null,
    readonly nome: string,
    readonly quantidade: Quantidade,
    readonly precoUnitario: Money,
    readonly controlarEstoque: boolean,
  ) {}

  static criar(input: VendaItemInput): Result<VendaItem> {
    const nome = (input.nome ?? "").trim()
    if (!nome) return err(new ValidacaoError("Item sem nome de produto."))

    const qtd = Quantidade.criar(input.quantidade)
    if (!qtd.ok) return qtd

    const preco = Money.deReais(input.precoUnitario)
    if (!preco.ok) return preco
    if (preco.value.ehNegativo()) {
      return err(new ValidacaoError("Preço unitário não pode ser negativo."))
    }

    const produtoId = input.produtoId ?? null
    const controlarEstoque = produtoId !== null && input.controlarEstoque !== false

    return ok(new VendaItem(produtoId, nome, qtd.value, preco.value, controlarEstoque))
  }

  get subtotal(): Money {
    return this.precoUnitario.multiplicarPor(this.quantidade.valor)
  }
}
