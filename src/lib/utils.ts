import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtBRL(value: number | string | null | undefined): string {
  const num = parseFloat(String(value || 0))
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/** Fuso da loja. Toda data "de hoje" do sistema é a de Ribeirão Preto. */
export const FUSO_LOJA = "America/Sao_Paulo"

/**
 * Data de hoje em `AAAA-MM-DD`, no fuso da loja.
 *
 * Substitui `new Date().toISOString().split("T")[0]`, que devolve a data
 * em UTC — e no Brasil (UTC-3) das 21h à meia-noite o UTC já virou o dia
 * seguinte. Como a live acontece justamente à noite, a data padrão saía
 * um dia à frente.
 *
 * É FUNÇÃO, não constante. `const hoje = ...` em escopo de módulo é
 * avaliado uma única vez por carregamento da página, e este sistema roda
 * como PWA que fica dias aberto sem recarregar: o valor congelava no dia
 * em que o app foi aberto e toda live nova nascia com aquela data.
 */
export function hojeISO(agora: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD, que é o que o <input type="date"> e o
  // Postgres esperam.
  return agora.toLocaleDateString("en-CA", { timeZone: FUSO_LOJA })
}

export function fmtData(date: string | null | undefined): string {
  if (!date) return "—"
  const [year, month, day] = date.split("T")[0].split("-")
  return `${day}/${month}/${year}`
}

export function fmtDataHora(date: string | null | undefined): string {
  if (!date) return "—"
  return new Date(date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
}
