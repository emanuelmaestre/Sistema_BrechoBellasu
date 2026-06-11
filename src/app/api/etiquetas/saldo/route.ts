import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { meSaldo, meRecarregar } from "@/lib/melhorenvio"

export const dynamic = "force-dynamic"

// GET /api/etiquetas/saldo
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    const data = await meSaldo()
    const total     = Number(data.balance ?? 0)
    const reservado = Number(data.reserved ?? 0)
    const dividas   = Number(data.debts ?? 0)
    // Saldo realmente utilizável para pagar etiquetas: desconta dívidas.
    const saldo     = Math.max(0, total - dividas)
    return NextResponse.json({ saldo, saldo_total: total, saldo_reservado: reservado, saldo_dividas: dividas })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível consultar o saldo. Verifique sua integração com o Melhor Envio."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})

// POST /api/etiquetas/saldo — cria recarga PIX
export const POST = withAuth(async (req: NextRequest) => {
  const { valor } = await req.json()
  if (!valor || isNaN(Number(valor)) || Number(valor) < 1) {
    return NextResponse.json({ erro: "Valor inválido. Mínimo R$ 1,00." }, { status: 400 })
  }

  try {
    const data = await meRecarregar(Number(valor))
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível gerar a recarga. Tente pelo Painel Melhor Envio."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
