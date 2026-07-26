import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAdminAuth } from "@/lib/with-auth"
import { PagarContaUseCase } from "@/application/financeiro/contas-pagar.use-cases"
import { ContaPagarRepositorySupabase } from "@/infrastructure/repositories/conta-pagar.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

export const PATCH = withAdminAuth(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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
})
