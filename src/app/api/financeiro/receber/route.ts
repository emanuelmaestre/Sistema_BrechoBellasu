import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

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
  let q = sb.from("v_contas_receber").select("*", { count: "exact" })
  if (status) q = q.eq("status", status)
  if (de)     q = q.gte("vencimento", de)
  if (ate)    q = q.lte("vencimento", ate)
  if (busca)  q = q.ilike("descricao", `%${busca}%`)

  const { data, count, error } = await q.order("vencimento").range(from, to)
  if (error) return NextResponse.json({ erro: "Erro ao buscar contas." }, { status: 500 })

  const soma = (data ?? []).reduce((a, r) => a + parseFloat(String(r.valor ?? 0)), 0)
  return NextResponse.json({ data, total: count, soma })
}

export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { descricao, valor, vencimento, cliente_id } = await req.json()
  if (!descricao || !valor || !vencimento) return NextResponse.json({ erro: "Campos obrigatórios faltando." }, { status: 400 })

  const sb = createServerClient()
  const { data, error } = await sb.from("contas_receber")
    .insert({ descricao, valor, vencimento, cliente_id: cliente_id ?? null })
    .select().single()

  if (error) return NextResponse.json({ erro: error.message ?? "Erro ao criar conta a receber." }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
