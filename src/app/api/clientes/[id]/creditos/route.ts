import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

// GET /api/clientes/[id]/creditos — histórico de movimentações + saldo atual
export const GET = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const clienteId = parseInt(id)
  const { searchParams } = req.nextUrl
  const tipo    = searchParams.get("tipo")       // "entrada" | "saida"
  const de      = searchParams.get("de")
  const ate     = searchParams.get("ate")
  const page    = parseInt(searchParams.get("page") ?? "1")
  const limit   = Math.min(parseInt(searchParams.get("per_page") ?? "50"), 200)
  const from    = (page - 1) * limit
  const to      = from + limit - 1

  const sb = createServerClient()

  // Saldo atual
  const { data: cli } = await sb
    .from("clientes")
    .select("saldo_credito")
    .eq("id", clienteId)
    .single()

  // Histórico filtrado
  let q = sb
    .from("creditos_clientes")
    .select("*, usuarios(nome)", { count: "exact" })
    .eq("cliente_id", clienteId)

  if (tipo) q = q.eq("tipo", tipo)
  if (de)   q = q.gte("created_at", `${de}T00:00:00`)
  if (ate)  q = q.lte("created_at", `${ate}T23:59:59`)

  const { data, count, error } = await q
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({
    data,
    total: count ?? 0,
    saldo: Number(cli?.saldo_credito ?? 0),
  })
})

// POST /api/clientes/[id]/creditos — adição manual de crédito
export const POST = withAuth(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  auth: { id: number; perfil: string }
) => {
  const { id } = await params
  const clienteId = parseInt(id)

  const body = await req.json()
  const valor  = Number(body.valor)
  const origem = (body.origem as string) || "manual"
  const obs    = (body.obs as string | undefined) || null

  if (!valor || valor <= 0) {
    return NextResponse.json({ erro: "Valor inválido." }, { status: 400 })
  }

  const origens = ["manual", "ajuste", "devolucao", "troca", "venda"]
  if (!origens.includes(origem)) {
    return NextResponse.json({ erro: "Origem inválida." }, { status: 400 })
  }

  const sb = createServerClient()
  const { data, error } = await sb.rpc("fn_credito_entrada", {
    p_cliente_id: clienteId,
    p_valor:      valor,
    p_origem:     origem,
    p_obs:        obs,
    p_op_id:      null,
    p_op_tipo:    null,
    p_user_id:    auth.id,
  })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({ saldo_novo: data }, { status: 201 })
})
