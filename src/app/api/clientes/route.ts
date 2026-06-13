import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { CriarClienteUseCase } from "@/application/clientes/criar-cliente.use-case"
import { ClienteRepositorySupabase } from "@/infrastructure/repositories/cliente.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"
import { enviarConsentimentoCliente } from "@/lib/consentimento-agent"
import { sincronizarContato } from "@/lib/google-contacts"

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

  if (busca) {
    const b = busca.replace(/^@/, "")
    q = q.or(`nome.ilike.%${b}%,cpf_cnpj.ilike.%${b}%,celular.ilike.%${b}%,instagram.ilike.%${b}%`)
  }
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

    // ── Envio automático da mensagem de consentimento ──────
    // Só envia se o cliente tem celular cadastrado
    if (body.celular) {
      await enviarConsentimentoCliente({
        clienteId: clienteId as number,
        nome: body.nome,
        celular: body.celular,
      })
    }

    // ── Sincronização Google Contacts (assíncrona, não bloqueia) ──
    if (body.celular) {
      sincronizarContato({
        clienteId: clienteId as number,
        nome:      body.nome,
        apelido:   body.apelido,
        instagram: body.instagram,
        celular:   body.celular,
      }).then(async result => {
        const sb3 = createServerClient()
        const now = new Date().toISOString()
        if (result.ok) {
          await sb3.from("clientes").update({
            google_contact_id:  result.googleContactId,
            google_sync_status: "sincronizado",
            google_sync_at:     now,
            google_sync_erro:   null,
            google_sync_tentativas: 1,
          }).eq("id", clienteId)
        } else {
          await sb3.from("clientes").update({
            google_sync_status:    "erro",
            google_sync_tentativa: now,
            google_sync_erro:      result.erro,
            google_sync_tentativas: 1,
          }).eq("id", clienteId)
        }
        await sb3.from("google_contacts_log").insert({
          cliente_id:        clienteId,
          acao:              result.acao,
          nome_montado:      result.nomeMontado,
          telefone_norm:     result.telefoneNorm,
          google_contact_id: result.googleContactId,
          sucesso:           result.ok,
          erro_msg:          result.erro ?? null,
        })
      }).catch(() => {})
    }

    return NextResponse.json({ id: clienteId }, { status: 201 })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[POST /api/clientes]", err)
    return NextResponse.json(erro, { status })
  }
})
