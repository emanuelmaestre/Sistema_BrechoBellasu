import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { AtualizarClienteUseCase } from "@/application/clientes/atualizar-cliente.use-case"
import { ClienteRepositorySupabase } from "@/infrastructure/repositories/cliente.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"
import { sincronizarContato } from "@/lib/google-contacts"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const sb = createServerClient()
  const { data, error } = await sb.from("clientes").select("*").eq("id", id).single()
  if (error || !data) return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 })
  return NextResponse.json(data)
})

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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

    // ── Sincronização Google Contacts (assíncrona, não bloqueia) ──
    if (body.celular || body.nome || body.apelido || body.instagram) {
      const sb2 = createServerClient()
      const { data: clienteAtual } = await sb2
        .from("clientes")
        .select("google_contact_id,google_sync_tentativas")
        .eq("id", id)
        .single()

      sincronizarContato({
        clienteId:       parseInt(id),
        nome:            body.nome,
        apelido:         body.apelido,
        instagram:       body.instagram,
        celular:         body.celular,
        googleContactId: clienteAtual?.google_contact_id,
      }).then(async result => {
        const sb3 = createServerClient()
        const now = new Date().toISOString()
        const tentativas = (clienteAtual?.google_sync_tentativas ?? 0) + 1
        if (result.ok) {
          await sb3.from("clientes").update({
            google_contact_id:     result.googleContactId,
            google_sync_status:    "sincronizado",
            google_sync_at:        now,
            google_sync_erro:      null,
            google_sync_tentativas: tentativas,
          }).eq("id", id)
        } else {
          await sb3.from("clientes").update({
            google_sync_status:    "erro",
            google_sync_tentativa: now,
            google_sync_erro:      result.erro,
            google_sync_tentativas: tentativas,
          }).eq("id", id)
        }
        await sb3.from("google_contacts_log").insert({
          cliente_id:        parseInt(id),
          acao:              result.acao,
          nome_montado:      result.nomeMontado,
          telefone_norm:     result.telefoneNorm,
          google_contact_id: result.googleContactId,
          sucesso:           result.ok,
          erro_msg:          result.erro ?? null,
        })
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[PUT /api/clientes/:id]", err)
    return NextResponse.json(erro, { status })
  }
})

export const DELETE = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const sb = createServerClient()
  const { error } = await sb.from("clientes").delete().eq("id", id)
  if (error) return NextResponse.json({ erro: "Erro ao excluir cliente." }, { status: 500 })
  return NextResponse.json({ ok: true })
})
