import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { AtualizarClienteUseCase } from "@/application/clientes/atualizar-cliente.use-case"
import { ClienteRepositorySupabase } from "@/infrastructure/repositories/cliente.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

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

  try {
    const { id } = await params
    const body = await req.json()
    const sb = createServerClient()
    const useCase = new AtualizarClienteUseCase(new ClienteRepositorySupabase(sb))

    const resultado = await useCase.execute(parseInt(id), {
      nome: body.nome,
      apelido: body.apelido,
      cpfCnpj: body.cpf_cnpj,
      email: body.email,
      dataNasc: body.data_nasc,
      celular: body.celular,
      instagram: body.instagram,
      cep: body.cep,
      logradouro: body.logradouro,
      numero: body.numero,
      complemento: body.complemento,
      bairro: body.bairro,
      cidade: body.cidade,
      estado: body.estado,
    })

    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[PUT /api/clientes/:id]", err)
    return NextResponse.json(erro, { status })
  }
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
