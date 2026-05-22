import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtBRL(value: number | string | null | undefined): string {
  const num = parseFloat(String(value || 0))
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
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
