import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { MENSAGEM_CONSENTIMENTO } from "@/lib/consentimento"
import { dispararTextoUnico } from "@/lib/disparo-controlado"

export const dynamic = "force-dynamic"

// PATCH /api/clientes/[id]/consentimento
// Body: { acao: "enviar" }   → envia mensagem única de consentimento (novidades + lives)
//       { acao: "revogar" }  → desativa consentimento e reseta status
export const PATCH = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const clienteId = parseInt(id)
  const body = await req.json() as { acao?: "enviar" | "revogar" }

  const sb = createServerClient()

  const { data: cliente } = await sb
    .from("clientes")
    .select("nome, celular, notificacao_status")
    .eq("id", clienteId)
    .single()

  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 })
  if (!cliente.celular) return NextResponse.json({ erro: "Cliente sem celular cadastrado." }, { status: 400 })

  // ── Revogar consentimento ────────────────────────────────
  if (body.acao === "revogar") {
    await sb.from("clientes")
      .update({
        aceita_novidades: "nao",
        aceita_lives: "nao",
        notificacao_status: null,
      })
      .eq("id", clienteId)
    return NextResponse.json({ ok: true, notificacao_status: null })
  }

  // ── Enviar mensagem de consentimento (padrão) ────────────

  // Idempotência: bloqueia reenvio se já está aguardando ou autorizado
  if (cliente.notificacao_status === "enviado") {
    return NextResponse.json({
      erro: "Mensagem já enviada. Aguarde a resposta do cliente antes de reenviar.",
      notificacao_status: "enviado",
    }, { status: 409 })
  }
  if (cliente.notificacao_status === "autorizado") {
    return NextResponse.json({
      erro: "Cliente já autorizou o recebimento de mensagens.",
      notificacao_status: "autorizado",
    }, { status: 409 })
  }

  const nome = (cliente.nome ?? "").split(" ")[0]
  const mensagem = MENSAGEM_CONSENTIMENTO(nome)

  // Marca como pendente enquanto envia
  await sb.from("clientes")
    .update({
      aceita_novidades: "aguardando",
      aceita_lives: "aguardando",
      notificacao_status: "pendente",
    })
    .eq("id", clienteId)

  const resultado = await dispararTextoUnico({
    clienteId: clienteId,
    nome:      cliente.nome ?? "Cliente",
    telefone:  cliente.celular,
    mensagem,
    tipo:      "consentimento",
    modulo:    "CLIENTES",
  })

  if (!resultado.ok) {
    // Reverte flags em caso de falha
    await sb.from("clientes")
      .update({
        aceita_novidades: "nao",
        aceita_lives: "nao",
        notificacao_status: "erro",
      })
      .eq("id", clienteId)
    return NextResponse.json({
      erro: `Falha ao enviar WhatsApp: ${resultado.erro}`,
      notificacao_status: "erro",
    }, { status: 502 })
  }

  await sb.from("clientes")
    .update({ notificacao_status: "enviado" })
    .eq("id", clienteId)

  return NextResponse.json({
    ok: true,
    notificacao_status: "enviado",
    messageId: resultado.messageId,
  })
})
