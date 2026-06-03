import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { CriarContaPagarUseCase } from "@/application/financeiro/contas-pagar.use-cases"
import { ContaPagarRepositorySupabase } from "@/infrastructure/repositories/conta-pagar.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl
  const status = searchParams.get("status")
  const de     = searchParams.get("de")
  const ate    = searchParams.get("ate")
  const busca  = searchParams.get("busca")
  const page   = parseInt(searchParams.get("page") ?? "1")
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)
  const from   = (page - 1) * limit
  const to     = from + limit - 1

  const sb = createServerClient()
  let q = sb.from("contas_pagar").select("*", { count: "exact" })
  if (status) q = q.eq("status", status)
  if (de)     q = q.gte("vencimento", de)
  if (ate)    q = q.lte("vencimento", ate)
  if (busca)  q = q.ilike("descricao", `%${busca}%`)

  const { data, count, error } = await q.order("vencimento").range(from, to)
  if (error) return NextResponse.json({ erro: "Não foi possível carregar as contas. Tente novamente." }, { status: 500 })

  const soma = (data ?? []).reduce((a, r) => a + parseFloat(String(r.valor ?? 0)), 0)
  return NextResponse.json({ data, total: count, soma })
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const sb = createServerClient()
    const useCase = new CriarContaPagarUseCase(new ContaPagarRepositorySupabase(sb))

    const resultado = await useCase.execute({
      descricao: body.descricao,
      valor: body.valor,
      vencimento: body.vencimento,
      categoria: body.categoria,
    })

    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }
    return NextResponse.json({ id: resultado.value.id }, { status: 201 })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[POST /api/financeiro/pagar]", err)
    return NextResponse.json(erro, { status })
  }
})
