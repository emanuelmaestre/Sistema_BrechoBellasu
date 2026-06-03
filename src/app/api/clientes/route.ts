import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { CriarClienteUseCase } from "@/application/clientes/criar-cliente.use-case"
import { ClienteRepositorySupabase } from "@/infrastructure/repositories/cliente.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"
import { enviarTexto } from "@/lib/zapi"
import { MENSAGEM_CONSENTIMENTO } from "@/lib/consentimento"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (req: NextRequest) => {
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
  if (error) return NextResponse.json({ erro: "Não foi possível carregar os clientes. Tente novamente." }, { status: 500 })

  return NextResponse.json({ data, total: count })
})

export const POST = withAuth(async (req: NextRequest) => {
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
      entregaCep: body.entrega_cep,
      entregaLogradouro: body.entrega_logradouro,
      entregaNumero: body.entrega_numero,
      entregaComplemento: body.entrega_complemento,
      entregaBairro: body.entrega_bairro,
      entregaCidade: body.entrega_cidade,
      entregaEstado: body.entrega_estado,
    })

    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }

    const clienteId = resultado.value.id
    const sb2 = createServerClient()

    // ── Envio automático da mensagem de consentimento ──────
    // Só envia se o cliente tem celular cadastrado
    if (body.celular) {
      const nome = (body.nome as string).split(" ")[0]
      const mensagem = MENSAGEM_CONSENTIMENTO(nome)

      // Marca como pendente antes de enviar
      await sb2.from("clientes").update({ notificacao_status: "pendente" }).eq("id", clienteId)

      const envio = await enviarTexto(body.celular, mensagem, "consentimento_novidades")

      // Atualiza status conforme resultado
      await sb2.from("clientes")
        .update({ notificacao_status: envio.ok ? "enviado" : "erro" })
        .eq("id", clienteId)
    }

    return NextResponse.json({ id: clienteId }, { status: 201 })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[POST /api/clientes]", err)
    return NextResponse.json(erro, { status })
  }
})
