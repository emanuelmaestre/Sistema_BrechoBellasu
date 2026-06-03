import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { CriarTrocaUseCase } from "@/application/trocas/troca.use-cases"
import { TrocaRepositorySupabase } from "@/infrastructure/repositories/troca.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl
  const tipo   = searchParams.get("tipo")
  const status = searchParams.get("status")
  const de     = searchParams.get("de")
  const ate    = searchParams.get("ate")
  const page   = parseInt(searchParams.get("page") ?? "1")
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)
  const from   = (page - 1) * limit
  const to     = from + limit - 1

  const sb = createServerClient()
  let q = sb.from("trocas").select("*, clientes(nome)", { count: "exact" })
  if (tipo)   q = q.eq("tipo", tipo)
  if (status) q = q.eq("status", status)
  if (de)     q = q.gte("created_at", `${de}T00:00:00`)
  if (ate)    q = q.lte("created_at", `${ate}T23:59:59`)

  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, to)
  if (error) return NextResponse.json({ erro: "Não foi possível carregar as trocas. Tente novamente." }, { status: 500 })
  return NextResponse.json({ data, total: count })
})

export const POST = withAuth(async (req: NextRequest, _ctx: unknown, auth: { id: number; perfil: string }) => {
  try {
    const body = await req.json()
    const sb = createServerClient()
    const useCase = new CriarTrocaUseCase(new TrocaRepositorySupabase(sb))

    const resultado = await useCase.execute(
      {
        tipo: body.tipo,
        motivo: body.motivo,
        vendaId: body.venda_id ?? null,
        clienteId: body.cliente_id ?? null,
        clienteNome: body.cliente_nome ?? null,
        produtoId: body.produto_id ?? null,
        nomeProduto: body.nome_produto ?? null,
        quantidade: body.quantidade ?? 1,
        observacoes: body.observacoes ?? null,
        status: body.status,
      },
      auth.id,
    )

    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }
    return NextResponse.json({ id: resultado.value.id }, { status: 201 })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[POST /api/trocas]", err)
    return NextResponse.json(erro, { status })
  }
})
