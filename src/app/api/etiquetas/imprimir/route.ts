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
// Faz proxy do PDF da etiqueta pela nossa própria origem, para exibir
// embutido no sistema (iframe), sem redirecionar para o Melhor Envio.
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const orderId = req.nextUrl.searchParams.get("order_id")
    if (!orderId) {
      return NextResponse.json({ erro: "order_id é obrigatório." }, { status: 400 })
    }
    const printed = await imprimirEtiqueta([orderId])
    if (!printed?.url) {
      return NextResponse.json({ erro: "Etiqueta ainda não disponível." }, { status: 404 })
    }
    // Baixa o PDF do Melhor Envio no servidor e repassa ao navegador
    const pdf = await fetch(printed.url)
    if (!pdf.ok) {
      return NextResponse.json({ erro: "Falha ao baixar a etiqueta." }, { status: 502 })
    }
    const buffer = await pdf.arrayBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": pdf.headers.get("content-type") ?? "application/pdf",
        "Content-Disposition": `inline; filename="etiqueta-${orderId}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível abrir a etiqueta."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
