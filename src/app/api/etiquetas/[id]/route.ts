import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { checkoutEtiquetas, gerarEtiquetas, cancelarEtiqueta } from "@/lib/melhorenvio"

// POST /api/etiquetas/[id]/checkout  — paga e gera a etiqueta
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params

  try {
    const { purchased } = await checkoutEtiquetas([id])
    const gerado = await gerarEtiquetas([id])
    return NextResponse.json({ purchased: purchased[0], label: gerado.orders?.[0] })
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
