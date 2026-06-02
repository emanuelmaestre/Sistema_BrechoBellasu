import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { enviarTexto } from "@/lib/zapi"

export const dynamic = "force-dynamic"

// PATCH /api/clientes/[id]/consentimento — Altera flag de consentimento e dispara msg
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const clienteId = parseInt(id)
  const { tipo, ativar } = await req.json() as { tipo: "novidades" | "lives"; ativar: boolean }

  if (!["novidades", "lives"].includes(tipo)) {
    return NextResponse.json({ erro: "Tipo inválido. Use 'novidades' ou 'lives'." }, { status: 400 })
  }

  const sb = createServerClient()

  // Busca cliente
  const { data: cliente } = await sb
    .from("clientes")
    .select("nome, celular, aceita_novidades, aceita_lives")
    .eq("id", clienteId)
    .single()

  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 })

  const campo = tipo === "novidades" ? "aceita_novidades" : "aceita_lives"

  if (!ativar) {
    // Desativar: marca como 'nao'
    await sb.from("clientes").update({ [campo]: "nao" }).eq("id", clienteId)
    return NextResponse.json({ ok: true, status: "nao" })
  }

  // Ativar: envia mensagem de consentimento e marca como 'aguardando'
  if (!cliente.celular) {
    return NextResponse.json({ erro: "Cliente sem celular cadastrado." }, { status: 400 })
  }

  const nome = cliente.nome?.split(" ")[0]

  const mensagem =
    `Oi ${nome}! 👋\n\n` +
    `O Brechó Bellasu pede sua autorização para enviar mensagens pelo WhatsApp sobre:\n\n` +
    `• 🛍️ Novidades, promoções e ofertas exclusivas\n` +
    `• 🎥 Avisos das nossas lives com peças selecionadas\n\n` +
    `Você pode cancelar quando quiser, é só nos avisar.\n\n` +
    `Responda:\n` +
    `✅ *SIM* — Autorizo\n` +
    `❌ *NÃO* — Não autorizo`

  const tipoLog = tipo === "novidades" ? "consentimento_novidades" as const : "consentimento_lives" as const

  await sb.from("clientes").update({ [campo]: "aguardando" }).eq("id", clienteId)
  const resultado = await enviarTexto(cliente.celular, mensagem, tipoLog)

  if (!resultado.ok) {
    // Reverte para 'nao' se não conseguiu enviar
    await sb.from("clientes").update({ [campo]: "nao" }).eq("id", clienteId)
    return NextResponse.json(
      { erro: `Falha ao enviar WhatsApp: ${resultado.erro}`, status: "nao" },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, status: "aguardando", messageId: resultado.messageId })
}
