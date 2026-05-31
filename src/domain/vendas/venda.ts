// ══════════════════════════════════════════════════════════════════
// Venda — entidade raiz do módulo. Encapsula invariantes:
//   • ao menos 1 item;
//   • total = Σ subtotais − desconto, nunca negativo.
// Sem dependência de banco/HTTP. Toda regra de cálculo vive aqui.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err, primeiroErro } from "../shared/result"
import { ValidacaoError } from "../shared/domain-error"
import { Money } from "../shared/money"
import { VendaItem, type VendaItemInput } from "./venda-item"
import { VendaSemItensError } from "./errors"

export interface VendaInput {
  clienteId?: number | null
  vendedorId: number
  formaPagamento?: string
  desconto?: number // em reais
  observacoes?: string | null
  itens: VendaItemInput[]
}

export class Venda {
  private constructor(
    readonly clienteId: number | null,
    readonly vendedorId: number,
    readonly formaPagamento: string,
    readonly itens: ReadonlyArray<VendaItem>,
    readonly desconto: Money,
    readonly observacoes: string | null,
  ) {}

  static criar(input: VendaInput): Result<Venda> {
    if (!input.itens?.length) return err(new VendaSemItensError())

    const itensResult = input.itens.map((it) => VendaItem.criar(it))
    const erroItem = primeiroErro(itensResult)
    if (erroItem) return err(erroItem)
    const itens = itensResult.map((r) => (r as { ok: true; value: VendaItem }).value)

    const descontoResult = Money.deReais(input.desconto ?? 0)
    if (!descontoResult.ok) return descontoResult
    if (descontoResult.value.ehNegativo()) {
      return err(new ValidacaoError("Desconto não pode ser negativo."))
    }

    return ok(
      new Venda(
        input.clienteId ?? null,
        input.vendedorId,
        input.formaPagamento || "Dinheiro",
        itens,
        descontoResult.value,
        input.observacoes ?? null,
      ),
    )
  }

  get subtotal(): Money {
    return this.itens.reduce((acc, it) => acc.somar(it.subtotal), Money.ZERO)
  }

  get total(): Money {
    return this.subtotal.subtrair(this.desconto).clampNaoNegativo()
  }

  /** Itens que devem baixar estoque (têm produtoId e controlam estoque). */
  itensControlados(): VendaItem[] {
    return this.itens.filter((it) => it.controlarEstoque && it.produtoId !== null)
  }
}
