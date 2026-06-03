import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

type RpcFn = "fn_vendas_periodo" | "fn_produtos_mais_vendidos" | "fn_ticket_medio" | "fn_formas_pagamento" | "fn_trocas_motivos" | "fn_fluxo_caixa"

export const GET = withAuth(async (req: NextRequest) => {
  const tipo = req.nextUrl.searchParams.get("tipo")
  const fnMap: Record<string, RpcFn> = {
    "vendas-periodo":        "fn_vendas_periodo",
    "produtos-mais-vendidos":"fn_produtos_mais_vendidos",
    "ticket-medio":          "fn_ticket_medio",
    "formas-pagamento":      "fn_formas_pagamento",
    "trocas-motivos":        "fn_trocas_motivos",
    "fluxo-caixa":           "fn_fluxo_caixa",
  }
  const fn = tipo ? fnMap[tipo] : null
  if (!fn) return NextResponse.json({ erro: "Tipo de relatório inválido." }, { status: 400 })

  const { searchParams } = req.nextUrl
  const de  = searchParams.get("de")
  const ate = searchParams.get("ate")

  const sb = createServerClient()
  const { data, error } = await sb.rpc(fn, { p_de: de ?? null, p_ate: ate ?? null })

  if (error) {
    console.error(`[rpc ${fn}]`, error.message)
    return NextResponse.json({ erro: "Não foi possível gerar o relatório. Tente novamente." }, { status: 500 })
  }
  return NextResponse.json(data ?? (fn === "fn_ticket_medio" ? {} : []))
})
