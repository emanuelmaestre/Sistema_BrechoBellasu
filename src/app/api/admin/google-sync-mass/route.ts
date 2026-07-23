import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { sincronizarContato, verificarTokenGoogle } from "@/lib/google-contacts"
import { normalizarTelefone, montarNomeContato } from "@/lib/google-contact-nome"

export const dynamic = "force-dynamic"

// GET /api/admin/google-sync-mass — prévia (sem executar)
export const GET = withAuth(async () => {
  const sb = createServerClient()
  const { data: clientes } = await sb
    .from("clientes")
    .select("id,nome,apelido,instagram,celular,cidade,google_contact_id,google_sync_status,google_sync_erro")
    .eq("ativo", true)
    .order("nome")

  // Verifica se o token atual é válido — é a fonte de verdade real.
  // Histórico de erros no banco não é suficiente: após reconectar e redeploiar,
  // o aviso deve sumir mesmo que clientes ainda tenham google_sync_status = 'erro'.
  const googleDesconectado = !(await verificarTokenGoogle())

  const preview = (clientes ?? []).map(c => {
    const tel  = normalizarTelefone(c.celular)
    const nome = montarNomeContato({ nome: c.nome, instagram: c.instagram, cidade: (c as Record<string,unknown>).cidade as string | null })
    const acao = c.google_contact_id ? "atualizar" : (tel.ok ? "criar" : "ignorar")
    return {
      id:          c.id,
      nome:        c.nome,
      nomeMontado: nome,
      telefone:    c.celular,
      telValido:   tel.ok,
      telErro:     tel.erro,
      temId:       !!c.google_contact_id,
      status:      c.google_sync_status,
      acao,
    }
  })

  const totais = {
    total:       preview.length,
    criarNovos:  preview.filter(c => c.acao === "criar").length,
    atualizar:   preview.filter(c => c.acao === "atualizar").length,
    semTelefone: preview.filter(c => !c.telefone).length,
    telInvalido: preview.filter(c => c.telefone && !c.telValido).length,
    ignorados:   preview.filter(c => c.acao === "ignorar").length,
  }

  return NextResponse.json({ totais, clientes: preview, googleDesconectado })
})

// POST /api/admin/google-sync-mass — sincroniza UM cliente (body: { cliente_id })
export const POST = withAuth(async (req: NextRequest, _ctx: unknown, auth: { id: number }) => {
  const { cliente_id } = await req.json()
  if (!cliente_id) {
    return NextResponse.json({ erro: "cliente_id obrigatório." }, { status: 400 })
  }

  const sb = createServerClient()
  const { data: cliente } = await sb
    .from("clientes")
    .select("id,nome,apelido,instagram,celular,cidade,google_contact_id,google_sync_tentativas")
    .eq("id", cliente_id)
    .single()

  if (!cliente) {
    return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 })
  }

  await sb.from("clientes").update({
    google_sync_status:    "sincronizando",
    google_sync_tentativa: new Date().toISOString(),
    google_sync_tentativas: (cliente.google_sync_tentativas ?? 0) + 1,
  }).eq("id", cliente_id)

  const result = await sincronizarContato({
    clienteId:       cliente.id,
    nome:            cliente.nome,
    apelido:         cliente.apelido,
    instagram:       cliente.instagram,
    celular:         cliente.celular,
    cidade:          (cliente as Record<string,unknown>).cidade as string | null,
    googleContactId: cliente.google_contact_id,
  })

  const now = new Date().toISOString()
  if (result.ok) {
    await sb.from("clientes").update({
      google_contact_id:  result.googleContactId,
      google_sync_status: "sincronizado",
      google_sync_at:     now,
      google_sync_erro:   null,
    }).eq("id", cliente_id)
  } else {
    await sb.from("clientes").update({
      google_sync_status: "erro",
      google_sync_erro:   result.erro,
    }).eq("id", cliente_id)
  }

  await sb.from("google_contacts_log").insert({
    cliente_id:        cliente.id,
    acao:              result.acao,
    nome_montado:      result.nomeMontado,
    telefone_norm:     result.telefoneNorm,
    google_contact_id: result.googleContactId,
    sucesso:           result.ok,
    erro_msg:          result.erro ?? null,
    criado_por_id:     auth.id,
  })

  return NextResponse.json({
    ok:          result.ok,
    clienteId:   cliente.id,
    nome:        cliente.nome,
    nomeMontado: result.nomeMontado,
    telefone:    result.telefoneNorm,
    acao:        result.acao,
    erro:        result.erro,
  })
})
