import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { sincronizarContato } from "@/lib/google-contacts"

export const dynamic = "force-dynamic"

// POST /api/clientes/[id]/google-sync — sincroniza (ou ressincroniza) o contato
export const POST = withAuth(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  auth: { id: number },
) => {
  const { id } = await params
  const sb = createServerClient()

  const { data: cliente, error } = await sb
    .from("clientes")
    .select("id,nome,apelido,instagram,celular,cidade,google_contact_id")
    .eq("id", id)
    .single()

  if (error || !cliente) {
    return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 })
  }

  // Marca sincronizando
  await sb.from("clientes")
    .update({
      google_sync_status:    "sincronizando",
      google_sync_tentativa: new Date().toISOString(),
      google_sync_tentativas: (cliente as Record<string, number>).google_sync_tentativas ?? 0 + 1,
    })
    .eq("id", id)

  const result = await sincronizarContato({
    clienteId:        cliente.id,
    nome:             cliente.nome,
    apelido:          cliente.apelido,
    instagram:        cliente.instagram,
    celular:          cliente.celular,
    cidade:           (cliente as Record<string, unknown>).cidade as string | null,
    googleContactId:  cliente.google_contact_id,
  })

  // Persiste resultado
  const now = new Date().toISOString()
  if (result.ok) {
    await sb.from("clientes").update({
      google_contact_id:  result.googleContactId,
      google_sync_status: "sincronizado",
      google_sync_at:     now,
      google_sync_erro:   null,
    }).eq("id", id)
  } else {
    await sb.from("clientes").update({
      google_sync_status: "erro",
      google_sync_erro:   result.erro,
    }).eq("id", id)
  }

  // Log de auditoria
  await sb.from("google_contacts_log").insert({
    cliente_id:       cliente.id,
    acao:             result.acao,
    nome_montado:     result.nomeMontado,
    telefone_norm:    result.telefoneNorm,
    google_contact_id: result.googleContactId,
    sucesso:          result.ok,
    erro_msg:         result.erro ?? null,
    criado_por_id:    auth.id,
  })

  if (!result.ok) {
    return NextResponse.json({ erro: result.erro }, { status: 422 })
  }

  return NextResponse.json({
    ok:              true,
    acao:            result.acao,
    googleContactId: result.googleContactId,
    nomeMontado:     result.nomeMontado,
  })
})
