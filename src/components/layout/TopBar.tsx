"use client"

import { usePathname } from "next/navigation"

const TITLES: Record<string, string> = {
  "/vendas":        "Vendas",
  "/clientes":      "Clientes",
  "/produtos":      "Produtos",
  "/financeiro":    "Financeiro",
  "/trocas":        "Trocas",
  "/relatorios":    "Relatórios",
  "/live":          "Live Commerce",
  "/etiquetas":     "Etiquetas de Envio",
  "/site":          "Site & E-commerce",
  "/configuracoes": "Configurações",
}

export function TopBar() {
  const pathname = usePathname()
  const title    = Object.entries(TITLES).find(([k]) => pathname.startsWith(k))?.[1] ?? "Dashboard"

  return (
    <header
      className="h-14 flex items-center px-6 shrink-0"
      style={{ background: "var(--topbar-bg)", borderBottom: "1px solid var(--border)" }}
    >
      <h1 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>{title}</h1>
    </header>
  )
}
