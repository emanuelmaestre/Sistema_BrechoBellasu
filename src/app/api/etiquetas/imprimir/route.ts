import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { imprimirEtiqueta } from "@/lib/melhorenvio"
import { sfImprimirEtiqueta, sfConfigurado } from "@/lib/superfrete"

export const dynamic = "force-dynamic"

// POST /api/etiquetas/imprimir  { order_id, carrier? }  → { url }
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const { order_id, carrier = "melhorenvio" } = await req.json()
    if (!order_id) return NextResponse.json({ erro: "order_id é obrigatório." }, { status: 400 })

    let url: string | undefined
    if (carrier === "superfrete") {
      if (!sfConfigurado()) return NextResponse.json({ erro: "Super Frete não configurado." }, { status: 503 })
      const printed = await sfImprimirEtiqueta([String(order_id)])
      url = printed?.url
    } else {
      const printed = await imprimirEtiqueta([String(order_id)])
      url = printed?.url
    }

    if (!url) return NextResponse.json({ erro: "Etiqueta ainda não disponível para impressão." }, { status: 404 })
    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível obter a etiqueta."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})

// GET /api/etiquetas/imprimir?order_id=X&carrier=melhorenvio
// Faz proxy do PDF — nunca expõe o domínio da transportadora ao navegador.
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = req.nextUrl
    const orderId = searchParams.get("order_id")
    const carrier = searchParams.get("carrier") ?? "melhorenvio"
    if (!orderId) return NextResponse.json({ erro: "order_id é obrigatório." }, { status: 400 })

    let printUrl: string | undefined
    if (carrier === "superfrete") {
      if (!sfConfigurado()) return NextResponse.json({ erro: "Super Frete não configurado." }, { status: 503 })
      const printed = await sfImprimirEtiqueta([orderId])
      printUrl = printed?.url
    } else {
      const printed = await imprimirEtiqueta([orderId])
      printUrl = printed?.url
    }

    if (!printUrl) return NextResponse.json({ erro: "Etiqueta ainda não disponível para impressão." }, { status: 404 })

    const pdfRes = await fetch(printUrl)
    if (!pdfRes.ok) return NextResponse.json({ erro: "Não foi possível baixar o PDF da etiqueta." }, { status: 502 })

    const buffer = await pdfRes.arrayBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="etiqueta-${orderId}.pdf"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível obter a etiqueta."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
