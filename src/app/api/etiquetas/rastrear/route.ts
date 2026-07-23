import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { rastrearEtiqueta } from "@/lib/melhorenvio"
import { sfRastrear, sfConfigurado } from "@/lib/superfrete"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl
  const orderId = searchParams.get("order_id")
  const carrier = searchParams.get("carrier") ?? "melhorenvio"

  if (!orderId) return NextResponse.json({ erro: "order_id obrigatório." }, { status: 400 })

  try {
    if (carrier === "superfrete") {
      if (!sfConfigurado()) {
        return NextResponse.json({ erro: "Super Frete não configurado." }, { status: 503 })
      }
      const data = await sfRastrear(orderId)
      return NextResponse.json(data)
    }

    const data = await rastrearEtiqueta(orderId)
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível rastrear o pedido. Verifique o código e tente novamente."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
