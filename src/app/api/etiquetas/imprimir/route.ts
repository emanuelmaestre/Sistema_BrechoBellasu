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

// GET /api/etiquetas/imprimir?order_id=X
// Busca a URL do PDF no Melhor Envio e faz o PROXY do arquivo (baixa aqui no
// servidor e devolve os bytes com content-type application/pdf). Assim o
// navegador da operadora nunca navega para o domínio do Melhor Envio — o PDF
// é exibido/baixado dentro do próprio sistema.
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const orderId = req.nextUrl.searchParams.get("order_id")
    if (!orderId) {
      return NextResponse.json({ erro: "order_id é obrigatório." }, { status: 400 })
    }
    const printed = await imprimirEtiqueta([orderId])
    if (!printed?.url) {
      return NextResponse.json({ erro: "Etiqueta ainda não disponível para impressão." }, { status: 404 })
    }

    const pdfRes = await fetch(printed.url)
    if (!pdfRes.ok) {
      return NextResponse.json({ erro: "Não foi possível baixar o PDF da etiqueta." }, { status: 502 })
    }
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
