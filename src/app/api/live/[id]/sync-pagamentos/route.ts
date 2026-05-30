import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { consultarPagamentoAsaas } from "@/lib/asaas"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const live_id = parseInt(id)
  const sb = createServerClient()

  // Busca compras com link de pagamento e que ainda não estão pagas
  const { data: compras, error } = await sb
    .from("live_compras")
    .select("id, asaas_payment_id, pagamento_status, link_pagamento")
    .eq("live_id", live_id)
    .neq("pagamento_status", "PAGO")
    .not("link_pagamento", "is", null)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  if (!compras?.length) return NextResponse.json({ ok: true, atualizadas: 0 })

  let atualizadas = 0

  for (const compra of compras) {
    const paymentId = (compra as Record<string, unknown>).asaas_payment_id as string | null
    if (!paymentId) continue

    const status = await consultarPagamentoAsaas(paymentId)
    if (status === "PAGO") {
      try {
        await sb.from("live_compras").update({ pagamento_status: "PAGO" }).eq("id", compra.id)
        atualizadas++
      } catch { /* silencia */ }
    }
  }

  return NextResponse.json({ ok: true, atualizadas })
}
