import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

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
  let q = sb.from("v_trocas").select("*", { count: "exact" })
  if (tipo)   q = q.eq("tipo", tipo)
  if (status) q = q.eq("status", status)
  if (de)     q = q.gte("created_at", `${de}T00:00:00`)
  if (ate)    q = q.lte("created_at", `${ate}T23:59:59`)

  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, to)
  if (error) return NextResponse.json({ erro: "Erro ao buscar trocas." }, { status: 500 })
  return NextResponse.json({ data, total: count })
}

export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const body = await req.json()
  const { tipo, venda_id, cliente_id, cliente_nome, produto_id, nome_produto, quantidade, motivo, status, decisao_produto, resultado_fin, observacoes } = body

  if (!tipo || !motivo) return NextResponse.json({ erro: "Tipo e motivo são obrigatórios." }, { status: 400 })

  const sb = createServerClient()

  // Fallback progressivo: tenta com todas as colunas → remove as opcionais se 42703
  let result = await sb.from("trocas")
    .insert({ tipo, venda_id, cliente_id: cliente_id ?? null, cliente_nome: cliente_nome ?? null, produto_id: produto_id ?? null, nome_produto: nome_produto ?? null, quantidade: quantidade ?? 1, motivo, status: status ?? "solicitado", responsavel_id: auth.id, decisao_produto, resultado_fin, observacoes })
    .select().single()

  if (result.error?.code === "42703") {
    result = await sb.from("trocas")
      .insert({ tipo, venda_id, cliente_id: cliente_id ?? null, produto_id: produto_id ?? null, quantidade: quantidade ?? 1, motivo, status: status ?? "solicitado", responsavel_id: auth.id })
      .select().single()
  }

  const { data, error } = result
  if (error) {
    console.error("[POST /api/trocas]", error)
    return NextResponse.json({ erro: error.message ?? "Erro ao criar troca." }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
