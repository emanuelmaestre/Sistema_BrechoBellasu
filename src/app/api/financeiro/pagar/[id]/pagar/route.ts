import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { PagarContaUseCase } from "@/application/financeiro/contas-pagar.use-cases"
import { ContaPagarRepositorySupabase } from "@/infrastructure/repositories/conta-pagar.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  try {
    const { id } = await params
    const hoje = new Date().toISOString().split("T")[0]
    const sb = createServerClient()
    const useCase = new PagarContaUseCase(new ContaPagarRepositorySupabase(sb))

    const resultado = await useCase.execute(parseInt(id), hoje)
    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[PATCH /api/financeiro/pagar/[id]/pagar]", err)
    return NextResponse.json(erro, { status })
  }
}
