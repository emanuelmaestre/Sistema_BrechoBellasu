import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { checkoutEtiquetas, gerarEtiquetas, buscarPedido, imprimirEtiqueta, cancelarEtiqueta } from "@/lib/melhorenvio"
import { sfCheckout, sfGerarEtiquetas, sfBuscarPedido, sfImprimirEtiqueta, sfCancelarEtiqueta, sfConfigurado } from "@/lib/superfrete"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// POST /api/etiquetas/[id]/checkout  — paga e gera a etiqueta
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params

  // Detecta o carrier a partir do banco (fallback: melhorenvio)
  const sb = createServerClient()
  const { data: row } = await sb.from("etiquetas").select("carrier").eq("me_order_id", id).maybeSingle()
  const carrier = (row?.carrier ?? "melhorenvio") as "melhorenvio" | "superfrete"

  try {
    if (carrier === "superfrete") {
      if (!sfConfigurado()) {
        return NextResponse.json({ erro: "Super Frete não configurado." }, { status: 503 })
      }
      const checkout = await sfCheckout([id])
      if (checkout.errors.length > 0) {
        const errStr = typeof checkout.errors[0] === "string" ? checkout.errors[0] : JSON.stringify(checkout.errors[0])
        return NextResponse.json({ erro: `Super Frete checkout: ${errStr}` }, { status: 422 })
      }
      await sfGerarEtiquetas([id]).catch(() => {})
      const pedido = await sfBuscarPedido(id).catch(() => null)
      const printed = await sfImprimirEtiqueta([id]).catch(() => null)
      return NextResponse.json({ ...pedido, label_url: printed?.url ?? pedido?.label_url ?? null, carrier: "superfrete" })
    }

    // Melhor Envio
    try {
      await checkoutEtiquetas([id])
    } catch (e) {
      const m = (e as Error).message.toLowerCase()
      if (m.includes("saldo") || m.includes("insufficient") || m.includes("balance")) {
        return NextResponse.json({ erro: "Saldo insuficiente na carteira do Melhor Envio. Recarregue para gerar a etiqueta." }, { status: 402 })
      }
      throw e
    }
    await gerarEtiquetas([id]).catch(() => {})
    const pedido = await buscarPedido(id).catch(() => null)
    const printed = await imprimirEtiqueta([id]).catch(() => null)
    return NextResponse.json({ ...pedido, label_url: printed?.url ?? pedido?.label_url ?? null })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar etiqueta."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}

// DELETE /api/etiquetas/[id]  — cancela/remove do carrinho
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params

  // Detecta o carrier a partir do banco (fallback: melhorenvio)
  const sb = createServerClient()
  const { data: row } = await sb.from("etiquetas").select("carrier").eq("me_order_id", id).maybeSingle()
  const carrier = (row?.carrier ?? "melhorenvio") as "melhorenvio" | "superfrete"

  try {
    if (carrier === "superfrete") {
      if (!sfConfigurado()) {
        return NextResponse.json({ erro: "Super Frete não configurado." }, { status: 503 })
      }
      const result = await sfCancelarEtiqueta(id)
      return NextResponse.json(result)
    }

    const result = await cancelarEtiqueta(id)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao cancelar etiqueta."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
