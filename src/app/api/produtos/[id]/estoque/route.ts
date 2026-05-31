import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { AjustarEstoqueUseCase } from "@/application/produtos/ajustar-estoque.use-case"
import { ProdutoRepositorySupabase } from "@/infrastructure/repositories/produto.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"
import type { OperacaoEstoque } from "@/domain/produtos/estoque"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  try {
    const { id } = await params
    const { quantidade, operacao } = await req.json()
    const sb = createServerClient()
    const useCase = new AjustarEstoqueUseCase(new ProdutoRepositorySupabase(sb))

    // operação ausente = define valor absoluto (compat. com o comportamento anterior)
    const op: OperacaoEstoque = operacao === "add" || operacao === "sub" ? operacao : "set"

    const resultado = await useCase.execute(parseInt(id), op, Number(quantidade))
    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }

    return NextResponse.json({ estoque_atual: resultado.value.estoqueAtual })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[PATCH /api/produtos/[id]/estoque]", err)
    return NextResponse.json(erro, { status })
  }
}
