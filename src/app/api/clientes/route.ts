import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { searchParams } = req.nextUrl
  const busca   = searchParams.get("busca")
  const status  = searchParams.get("status")
  const page    = parseInt(searchParams.get("page") ?? "1")
  const limit   = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)
  const from    = (page - 1) * limit
  const to      = from + limit - 1

  const sb = createServerClient()
  let q = sb.from("clientes").select("*", { count: "exact" })

  if (busca) q = q.or(`nome.ilike.%${busca}%,cpf_cnpj.ilike.%${busca}%,celular.ilike.%${busca}%`)
  if (status === "inativo") q = q.eq("ativo", false)
  else if (status !== "todos") q = q.neq("ativo", false)

  const { data, count, error } = await q.order("nome").range(from, to)
  if (error) return NextResponse.json({ erro: "Erro ao buscar clientes." }, { status: 500 })

  return NextResponse.json({ data, total: count })
}

export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const body = await req.json()
  const { nome, apelido, cpf_cnpj, data_nasc, celular, instagram, cep, logradouro, numero, complemento, bairro, cidade, estado } = body

  if (!nome) return NextResponse.json({ erro: "Nome é obrigatório." }, { status: 400 })

  const sb = createServerClient()

  // Tenta com todas as colunas novas; fallback progressivo se coluna não existir
  let result = await sb.from("clientes")
    .insert({ nome, apelido, cpf_cnpj, data_nasc, celular, instagram, cep, logradouro, numero, complemento, bairro, cidade, estado })
    .select().single()

  if (result.error?.code === "42703") {
    result = await sb.from("clientes")
      .insert({ nome, cpf_cnpj, data_nasc, celular, instagram, cep, logradouro, numero, complemento, bairro, cidade, estado })
      .select().single()
  }
  if (result.error?.code === "42703") {
    result = await sb.from("clientes")
      .insert({ nome, cpf_cnpj, data_nasc, celular, cep, logradouro, numero, complemento, bairro, cidade, estado })
      .select().single()
  }

  const { data, error } = result
  if (error) {
    console.error("[POST /api/clientes]", error)
    return NextResponse.json({ erro: error.message ?? "Erro ao criar cliente." }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
