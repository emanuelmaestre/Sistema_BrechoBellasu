// ══════════════════════════════════════════════════════════════════
// LiveCompra — entidade de uma compra (sacola) feita durante uma live.
// Calcula o valor final (valor_total − desconto, nunca negativo) via
// Money. Validada na criação.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "../shared/result"
import { ValidacaoError } from "../shared/domain-error"
import { Money } from "../shared/money"

export interface LiveCompraInput {
  liveId: number
  clienteId?: number | null
  nomeCliente?: string | null
  whatsapp?: string | null
  dataCompra?: string | null
  corSacola?: string | null
  numeroSacola?: string | null
  quantidadeItens?: number
  valorTotal: number
  desconto?: number
  observacoes?: string | null
}

const norm = (v?: string | null): string | null => {
  const t = (v ?? "").toString().trim()
  return t ? t : null
}

export class LiveCompra {
  private constructor(
    readonly liveId: number,
    readonly clienteId: number | null,
    readonly nomeCliente: string | null,
    readonly whatsapp: string | null,
    readonly dataCompra: string,
    readonly corSacola: string | null,
    readonly numeroSacola: string | null,
    readonly quantidadeItens: number,
    readonly valorTotal: Money,
    readonly desconto: Money,
    readonly observacoes: string | null,
  ) {}

  static criar(input: LiveCompraInput): Result<LiveCompra> {
    if (!Number.isInteger(input.liveId) || input.liveId <= 0) {
      return err(new ValidacaoError("Live inválida."))
    }

    const valorTotal = Money.deReais(input.valorTotal ?? 0)
    if (!valorTotal.ok) return valorTotal
    if (valorTotal.value.ehNegativo()) {
      return err(new ValidacaoError("Valor total não pode ser negativo."))
    }

    const desconto = Money.deReais(input.desconto ?? 0)
    if (!desconto.ok) return desconto
    if (desconto.value.ehNegativo()) {
      return err(new ValidacaoError("Desconto não pode ser negativo."))
    }

    const qtd = input.quantidadeItens ?? 1
    if (!Number.isInteger(qtd) || qtd < 0) {
      return err(new ValidacaoError("Quantidade de itens inválida."))
    }

    return ok(
      new LiveCompra(
        input.liveId,
        input.clienteId ?? null,
        norm(input.nomeCliente),
        norm(input.whatsapp),
        norm(input.dataCompra) ?? new Date().toISOString().split("T")[0],
        norm(input.corSacola),
        norm(input.numeroSacola),
        qtd,
        valorTotal.value,
        desconto.value,
        norm(input.observacoes),
      ),
    )
  }

  /** Valor a cobrar (total − desconto, mínimo zero). */
  get valorFinal(): Money {
    return this.valorTotal.subtrair(this.desconto).clampNaoNegativo()
  }

  /** Descrição da sacola para a cobrança (ex: "Rosa #12"). */
  get descricaoSacola(): string {
    return [this.corSacola, this.numeroSacola ? `#${this.numeroSacola}` : ""]
      .filter(Boolean)
      .join(" ")
      .trim()
  }
}
