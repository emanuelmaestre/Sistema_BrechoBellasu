import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { checkoutEtiquetas, gerarEtiquetas, buscarPedido, imprimirEtiqueta, cancelarEtiqueta } from "@/lib/melhorenvio"

export const dynamic = "force-dynamic"

// POST /api/etiquetas/[id]/checkout  — paga e gera a etiqueta
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params

  try {
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

  try {
    const result = await cancelarEtiqueta(id)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao cancelar etiqueta."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
