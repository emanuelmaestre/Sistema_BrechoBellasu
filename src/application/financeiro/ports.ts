// Contratos do módulo Financeiro.
import type { ContaPagar } from "@/domain/financeiro/conta-pagar"
import type { ContaReceber } from "@/domain/financeiro/conta-receber"

export interface IContaPagarRepository {
  criar(conta: ContaPagar): Promise<{ id: number }>
  /** Marca como paga, registrando a data de pagamento (coluna pago_em). */
  marcarPago(id: number, pagoEm: string): Promise<void>
}

export interface IContaReceberRepository {
  criar(conta: ContaReceber): Promise<{ id: number }>
  /** Marca como recebida, registrando a data (coluna recebido_em). */
  marcarRecebido(id: number, recebidoEm: string): Promise<void>
}
