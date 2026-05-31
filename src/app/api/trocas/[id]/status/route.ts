import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { AtualizarStatusTrocaUseCase } from "@/application/trocas/troca.use-cases"
import { TrocaRepositorySupabase } from "@/infrastructure/repositories/troca.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  try {
    const { id } = await params
    const { status, decisao_produto, resultado_fin } = await req.json()
    const sb = createServerClient()
    const useCase = new AtualizarStatusTrocaUseCase(new TrocaRepositorySupabase(sb))

    const resultado = await useCase.execute(
      parseInt(id),
      status,
      decisao_produto ?? null,
      resultado_fin ?? null,
    )

    if (!resultado.ok) {
      const { status: st, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status: st })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[PATCH /api/trocas/[id]/status]", err)
    return NextResponse.json(erro, { status })
  }
}
