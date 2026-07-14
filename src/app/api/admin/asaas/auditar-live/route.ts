import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { createServerClient } from "@/lib/supabase"
import { detalharPagamentoAsaas } from "@/lib/asaas"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET /api/admin/asaas/auditar-live?live_id=32
// Para cada compra da live que tem cobrança Asaas, compara o valor REAL da
// cobrança (o que a cliente vê no link) com o valor final ATUAL da compra.
// Se divergirem, o link ficou obsoleto (compra editada após gerar o link).
export const GET = withAuth(async (req: NextRequest) => {
  const liveId = parseInt(req.nextUrl.searchParams.get("live_id") ?? "")
  if (!Number.isInteger(liveId)) {
    return NextResponse.json({ erro: "Informe ?live_id=<n>" }, { status: 400 })
  }

  const sb = createServerClient()
  const { data: compras, error } = await sb
    .from("live_compras")
    .select("id, nome_cliente, numero_sacola, valor_total, desconto, credito_aplicado, asaas_payment_id, link_pagamento, msg_status, pagamento_status")
    .eq("live_id", liveId)
    .order("nome_cliente")
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  const cent = (v: unknown) => Math.round((parseFloat(String(v ?? 0)) || 0) * 100)

  const linhas = []
  for (const c of compras ?? []) {
    const valorFinalAtual = Math.max(0, cent(c.valor_total) - cent(c.desconto) - cent(c.credito_aplicado)) / 100

    if (!c.asaas_payment_id) {
      linhas.push({
        id: c.id, cliente: c.nome_cliente,
        sacola: c.numero_sacola ?? "",
        valor_atual: valorFinalAtual, valor_no_asaas: null,
        situacao: c.link_pagamento ? "sem_payment_id" : "sem_cobranca",
      })
      continue
    }

    const asaas = await detalharPagamentoAsaas(c.asaas_payment_id)
    if (!asaas) {
      linhas.push({
        id: c.id, cliente: c.nome_cliente,
        sacola: c.numero_sacola ?? "",
        valor_atual: valorFinalAtual, valor_no_asaas: null,
        situacao: "nao_encontrada_no_asaas",
      })
      continue
    }

    const divergente = Math.round(asaas.value * 100) !== Math.round(valorFinalAtual * 100)
    linhas.push({
      id: c.id, cliente: c.nome_cliente,
      sacola: c.numero_sacola ?? "",
      valor_atual: valorFinalAtual,
      valor_no_asaas: asaas.value,
      descricao_asaas: asaas.description,
      status_asaas: asaas.status,
      situacao: divergente ? "DIVERGENTE" : "ok",
    })
  }

  const divergentes = linhas.filter(l => l.situacao === "DIVERGENTE")
  return NextResponse.json({
    live_id: liveId,
    total_compras: linhas.length,
    divergentes: divergentes.length,
    resumo: divergentes.length === 0
      ? "Nenhuma divergência: todos os links batem com o valor atual."
      : `${divergentes.length} compra(s) com link de valor divergente do valor atual.`,
    compras: linhas,
  })
})
