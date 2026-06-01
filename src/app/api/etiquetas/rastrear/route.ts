import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { rastrearEtiqueta } from "@/lib/melhorenvio"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Você precisa estar logado para realizar esta ação." }, { status: 401 })

  const orderId = req.nextUrl.searchParams.get("order_id")
  if (!orderId) return NextResponse.json({ erro: "order_id obrigatório." }, { status: 400 })

  try {
    const data = await rastrearEtiqueta(orderId)
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível rastrear o pedido. Verifique o código e tente novamente."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
