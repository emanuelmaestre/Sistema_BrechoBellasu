import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { rastrearEtiqueta } from "@/lib/melhorenvio"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const orderId = req.nextUrl.searchParams.get("order_id")
  if (!orderId) return NextResponse.json({ erro: "order_id obrigatório." }, { status: 400 })

  try {
    const data = await rastrearEtiqueta(orderId)
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao rastrear."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
