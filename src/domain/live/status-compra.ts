// ══════════════════════════════════════════════════════════════════
// Regras de status/finalização da compra da live (puras, testáveis).
//   • status: aguardando_vinculo → vinculo_parcial → vinculada → finalizada
//   • só finaliza se vinculou a quantidade esperada (não há mais controle de estoque)
// ══════════════════════════════════════════════════════════════════
import { type Result, ok, err } from "../shared/result"
import { FinalizacaoInvalidaError } from "./errors"

export type StatusCompra = "aguardando_vinculo" | "vinculo_parcial" | "vinculada" | "finalizada"

export interface VinculoResumo {
  quantidade: number
  /** Legado: sem controle de estoque, não influencia mais nenhuma regra. */
  estoqueBaixado: boolean
}

function totais(vinculos: VinculoResumo[]) {
  const vinculado = vinculos.reduce((s, v) => s + (v.quantidade ?? 1), 0)
  return { vinculado }
}

export function calcularStatusCompra(qtdEsperada: number, vinculos: VinculoResumo[]): StatusCompra {
  const { vinculado } = totais(vinculos)
  if (vinculado === 0) return "aguardando_vinculo"
  // Todos vinculados → finalizada automaticamente (sem clique extra)
  if (vinculado >= qtdEsperada) return "finalizada"
  return "vinculo_parcial"
}

export function validarFinalizacao(qtdEsperada: number, vinculos: VinculoResumo[]): Result<void> {
  if (vinculos.length === 0) {
    return err(new FinalizacaoInvalidaError("Vincule os produtos desta compra antes de finalizar."))
  }
  const { vinculado } = totais(vinculos)
  if (vinculado < qtdEsperada) {
    return err(
      new FinalizacaoInvalidaError(
        `A compra tem ${qtdEsperada} item(ns) mas apenas ${vinculado} foi(ram) vinculado(s). Vincule todos antes de finalizar.`,
      ),
    )
  }
  return ok(undefined)
}
