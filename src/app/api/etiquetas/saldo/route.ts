import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { meSaldo, meRecarregar } from "@/lib/melhorenvio"

export const dynamic = "force-dynamic"

// GET /api/etiquetas/saldo
export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  try {
    const data = await meSaldo()
    const saldo = parseFloat(data.balance ?? data.wallet_balance ?? "0")
    return NextResponse.json({ saldo })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao buscar saldo."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}

// POST /api/etiquetas/saldo — cria recarga PIX
export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { valor } = await req.json()
  if (!valor || isNaN(Number(valor)) || Number(valor) < 1) {
    return NextResponse.json({ erro: "Valor inválido. Mínimo R$ 1,00." }, { status: 400 })
  }

  try {
    const data = await meRecarregar(Number(valor))
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar recarga."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
