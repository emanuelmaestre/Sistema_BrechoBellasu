import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { CriarClienteUseCase } from "@/application/clientes/criar-cliente.use-case"
import { ClienteRepositorySupabase } from "@/infrastructure/repositories/cliente.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

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

  try {
    const body = await req.json()
    const sb = createServerClient()
    const useCase = new CriarClienteUseCase(new ClienteRepositorySupabase(sb))

    const resultado = await useCase.execute({
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
    return NextResponse.json({ id: resultado.value.id }, { status: 201 })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[POST /api/clientes]", err)
    return NextResponse.json(erro, { status })
  }
}
