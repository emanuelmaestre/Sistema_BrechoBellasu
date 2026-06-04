import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { imprimirEtiqueta } from "@/lib/melhorenvio"

export const dynamic = "force-dynamic"

// POST /api/etiquetas/imprimir  { order_id }  → { url }
// Retorna a URL do PDF da etiqueta já paga/gerada (não gera cobrança).
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const { order_id } = await req.json()
    if (!order_id) {
      return NextResponse.json({ erro: "order_id é obrigatório." }, { status: 400 })
    }
    const printed = await imprimirEtiqueta([String(order_id)])
    if (!printed?.url) {
      return NextResponse.json({ erro: "Etiqueta ainda não disponível para impressão." }, { status: 404 })
    }
    return NextResponse.json({ url: printed.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível obter a etiqueta."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
