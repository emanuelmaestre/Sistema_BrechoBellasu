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

  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

  // ── Mensagens que deixam claro os 2 casos: novidades E lives ──
  const variacoesNovidades = [
    `Oi ${nome}! 👗✨\n\nPosso te enviar pelo WhatsApp:\n• 🛍️ *Novidades e promoções* do brechó\n• 🎥 *Avisos de lives* com peças novas\n\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💛`,
    `Olá ${nome}! 🌸\n\nGostaria de te manter por dentro do Brechó Bellasu:\n• 👗 *Novidades e ofertas exclusivas*\n• 📱 *Avisos quando abrirmos lives*\n\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💕`,
    `Oi ${nome}! 🎀\n\nPosso te enviar mensagens sobre:\n• ✨ *Promoções e peças novas*\n• 🎬 *Avisos das nossas lives*\n\nResponda *SIM* para aceitar ou *NÃO* para recusar. 🛍️`,
    `Olá ${nome}! 💛\n\nQuer ficar por dentro de tudo do Brechó Bellasu?\n• 👠 *Novidades e promoções especiais*\n• 🎥 *Avisos das nossas lives ao vivo*\n\nResponda *SIM* para aceitar ou *NÃO* para recusar. 🌺`,
    `Oi ${nome}! 🌟\n\nPosso te enviar pelo WhatsApp:\n• 🛍️ *Promoções e peças selecionadas*\n• 📲 *Avisos quando tivermos lives*\n\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💛`,
  ]

  // Lives: mesma mensagem completa, só muda o gancho inicial
  const variacoesLives = [
    `Oi ${nome}! 🎥✨\n\nPosso te enviar pelo WhatsApp:\n• 📲 *Avisos das nossas lives* com peças novas\n• 🛍️ *Novidades e promoções* do brechó\n\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💛`,
    `Olá ${nome}! 📱🌸\n\nQuer receber nossos avisos por aqui?\n• 🎬 *Avisos quando abrirmos uma live*\n• 👗 *Novidades e ofertas especiais*\n\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💕`,
    `Oi ${nome}! 🌟\n\nPosso te chamar nas nossas lives e te enviar:\n• 🎥 *Avisos de lives com peças selecionadas*\n• ✨ *Promoções e novidades do brechó*\n\nResponda *SIM* para aceitar ou *NÃO* para recusar. 🛍️`,
    `Olá ${nome}! 🎀💫\n\nQuer ficar sabendo de tudo em primeira mão?\n• 📲 *Avisos das nossas lives ao vivo*\n• 👠 *Novidades e promoções exclusivas*\n\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💛`,
    `Oi ${nome}! 🌺\n\nPosso te enviar pelo WhatsApp:\n• 🎬 *Avisos quando abrirmos lives*\n• 🛍️ *Promoções e peças novas do brechó*\n\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💛`,
  ]

  const mensagem = tipo === "novidades" ? pick(variacoesNovidades) : pick(variacoesLives)

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
