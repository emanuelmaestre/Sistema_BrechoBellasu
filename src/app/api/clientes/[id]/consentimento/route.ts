import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { enviarTexto } from "@/lib/zapi"
import { MENSAGEM_CONSENTIMENTO } from "@/lib/consentimento"

export const dynamic = "force-dynamic"

// PATCH /api/clientes/[id]/consentimento
// Body: { tipo: "novidades"|"lives", ativar: boolean }
//       ou { reenviar: true } para reenvio manual da mensagem de consentimento
export const PATCH = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const clienteId = parseInt(id)
  const body = await req.json() as {
    tipo?: "novidades" | "lives"
    ativar?: boolean
    reenviar?: boolean
  }

  const sb = createServerClient()

  // Busca cliente
  const { data: cliente } = await sb
    .from("clientes")
    .select("nome, celular, aceita_novidades, aceita_lives, notificacao_status")
    .eq("id", clienteId)
    .single()

  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 })
  if (!cliente.celular) return NextResponse.json({ erro: "Cliente sem celular cadastrado." }, { status: 400 })

  // ── Reenvio manual da mensagem de consentimento ──────────
  if (body.reenviar) {
    // Bloqueia reenvio se já foi enviado com sucesso (regra 7)
    if (cliente.notificacao_status === "enviado") {
      return NextResponse.json({ erro: "Notificação já foi enviada com sucesso. Não é necessário reenviar." }, { status: 409 })
    }

    const nome = cliente.nome?.split(" ")[0]
    const mensagem = MENSAGEM_CONSENTIMENTO(nome)

    await sb.from("clientes").update({ notificacao_status: "pendente" }).eq("id", clienteId)
    const resultado = await enviarTexto(cliente.celular, mensagem, "consentimento_novidades")
    await sb.from("clientes")
      .update({ notificacao_status: resultado.ok ? "enviado" : "erro" })
      .eq("id", clienteId)

    if (!resultado.ok) {
      return NextResponse.json({ erro: `Falha ao enviar: ${resultado.erro}`, notificacao_status: "erro" }, { status: 502 })
    }

    return NextResponse.json({ ok: true, notificacao_status: "enviado", messageId: resultado.messageId })
  }

  // ── Alterar flag de consentimento (novidades ou lives) ───
  const { tipo, ativar } = body
  if (!tipo || !["novidades", "lives"].includes(tipo)) {
    return NextResponse.json({ erro: "Tipo inválido. Use 'novidades' ou 'lives'." }, { status: 400 })
  }

  const campo = tipo === "novidades" ? "aceita_novidades" : "aceita_lives"

  if (!ativar) {
    await sb.from("clientes").update({ [campo]: "nao" }).eq("id", clienteId)
    return NextResponse.json({ ok: true, status: "nao" })
  }

  await sb.from("clientes").update({ [campo]: "aguardando" }).eq("id", clienteId)
  const resultado = await enviarTexto(
    cliente.celular,
    MENSAGEM_CONSENTIMENTO(cliente.nome?.split(" ")[0]),
    tipo === "novidades" ? "consentimento_novidades" : "consentimento_lives",
  )

  if (!resultado.ok) {
    await sb.from("clientes").update({ [campo]: "nao" }).eq("id", clienteId)
    return NextResponse.json({ erro: `Falha ao enviar WhatsApp: ${resultado.erro}`, status: "nao" }, { status: 502 })
  }

  return NextResponse.json({ ok: true, status: "aguardando", messageId: resultado.messageId })
})
