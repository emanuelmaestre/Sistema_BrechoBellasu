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

    const trocaId = resultado.value.id
    const valorProduto = Number(body.valor_produto) || 0
    let creditoGerado = 0

    // Persiste valor_produto e gera crédito se houver cliente e valor
    if (valorProduto > 0) {
      const sb2 = createServerClient()

      // Salva valor_produto na troca
      await sb2.from("trocas").update({ valor_produto: valorProduto }).eq("id", trocaId)

      // Gera crédito se houver cliente
      if (body.cliente_id) {
        try {
          const origem = body.tipo === "devolucao" ? "devolucao" : "troca"
          const obs = `${body.tipo === "devolucao" ? "Devolução" : "Troca"} #${trocaId}` +
            (body.nome_produto ? ` — ${body.nome_produto}` : "")

          await sb2.rpc("fn_credito_entrada", {
            p_cliente_id: body.cliente_id,
            p_valor:      valorProduto,
            p_origem:     origem,
            p_obs:        obs,
            p_op_id:      trocaId,
            p_op_tipo:    "troca",
            p_user_id:    auth.id,
          })

          await sb2.from("trocas").update({ credito_gerado: valorProduto }).eq("id", trocaId)
          creditoGerado = valorProduto
        } catch (err) {
          console.error("[POST /api/trocas] erro ao gerar crédito:", err)
        }
      }
    }

    return NextResponse.json({ id: trocaId, credito_gerado: creditoGerado }, { status: 201 })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[POST /api/trocas]", err)
    return NextResponse.json(erro, { status })
  }
})
