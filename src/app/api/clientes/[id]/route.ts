import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const sb = createServerClient()
  const { data, error } = await sb.from("clientes").select("*").eq("id", id).single()
  if (error || !data) return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { nome, apelido, cpf_cnpj, data_nasc, celular, instagram, cep, logradouro, numero, complemento, bairro, cidade, estado } = body

  if (!nome) return NextResponse.json({ erro: "Nome é obrigatório." }, { status: 400 })

  const sb = createServerClient()

  // Fallback progressivo: tenta com todas as colunas → remove as que não existem (42703)
  const tentativas = [
    { nome, apelido, cpf_cnpj, data_nasc, celular, instagram, cep, logradouro, numero, complemento, bairro, cidade, estado },
    { nome, cpf_cnpj, data_nasc, celular, instagram, cep, logradouro, numero, complemento, bairro, cidade, estado },
    { nome, cpf_cnpj, data_nasc, celular, cep, logradouro, numero, complemento, bairro, cidade, estado },
    { nome, cpf_cnpj, data_nasc, celular },
  ]

  let lastError = null
  for (const payload of tentativas) {
    const { error } = await sb.from("clientes").update(payload).eq("id", id)
    if (!error) {
      const { data: updated } = await sb.from("clientes").select("*").eq("id", id).single()
      return NextResponse.json(updated ?? { ok: true })
    }
    lastError = error
    // Só continua se for erro de coluna inexistente
    if (error.code !== "42703") break
  }

  console.error("[PUT /api/clientes/:id]", lastError)
  return NextResponse.json({ erro: "Erro ao atualizar cliente." }, { status: 500 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const sb = createServerClient()
  const { error } = await sb.from("clientes").delete().eq("id", id)
  if (error) return NextResponse.json({ erro: "Erro ao excluir cliente." }, { status: 500 })
  return NextResponse.json({ ok: true })
}
