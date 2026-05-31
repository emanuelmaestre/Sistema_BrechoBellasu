import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { FinalizarCompraUseCase } from "@/application/live/finalizar-compra.use-case"
import { LiveProdutoRepositorySupabase } from "@/infrastructure/repositories/live-produto.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string; compraId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  try {
    const { compraId } = await params
    const sb = createServerClient()
    const useCase = new FinalizarCompraUseCase(new LiveProdutoRepositorySupabase(sb))

    const resultado = await useCase.execute(parseInt(compraId))
    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[POST /api/live/[id]/compras/[compraId]/finalizar]", err)
    return NextResponse.json(erro, { status })
  }
}
