// ══════════════════════════════════════════════════════════════════
// Regra de ajuste de estoque. Pura e testável. O estoque resultante
// nunca pode ser negativo.
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "../shared/result"
import { ValidacaoError } from "../shared/domain-error"
import { EstoqueNegativoError } from "./errors"

export type OperacaoEstoque = "add" | "sub" | "set"

export function calcularNovoEstoque(
  atual: number,
  operacao: OperacaoEstoque,
  quantidade: number,
): Result<number> {
  if (!Number.isInteger(quantidade) || quantidade < 0) {
    return err(new ValidacaoError("Quantidade de estoque deve ser um inteiro ≥ 0."))
  }

  let resultado: number
  switch (operacao) {
    case "add":
      resultado = atual + quantidade
      break
    case "sub":
      resultado = atual - quantidade
      break
    case "set":
      resultado = quantidade
      break
    default:
      return err(new ValidacaoError("Operação de estoque inválida."))
  }

  if (resultado < 0) return err(new EstoqueNegativoError(resultado))
  return ok(resultado)
}
