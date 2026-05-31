import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { SincronizarPagamentosLiveUseCase } from "@/application/live/sincronizar-pagamentos.use-case"
import { LiveCompraRepositorySupabase } from "@/infrastructure/repositories/live-compra.repository"
import { AsaasGateway } from "@/infrastructure/services/asaas.gateway"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  try {
    const { id } = await params
    const sb = createServerClient()
    const useCase = new SincronizarPagamentosLiveUseCase(
      new LiveCompraRepositorySupabase(sb),
      new AsaasGateway(),
    )

    const resultado = await useCase.execute(parseInt(id))
    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }

    return NextResponse.json({ ok: true, atualizadas: resultado.value.atualizadas })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[POST /api/live/[id]/sync-pagamentos]", err)
    return NextResponse.json(erro, { status })
  }
}
