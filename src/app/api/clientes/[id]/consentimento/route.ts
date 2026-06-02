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

  // Variações de mensagem para não parecer robô
  const variacoesNovidades = [
    `Oi ${nome}! 👗✨ Posso te enviar novidades e promoções do Brechó Bellasu pelo WhatsApp?\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💛`,
    `Olá ${nome}! 🛍️💫 Gostaria de receber nossas novidades e ofertas especiais por aqui?\nResponda *SIM* para aceitar ou *NÃO* para recusar. 🌸`,
    `Oi ${nome}! 👠🌟 Quer ser a primeira a saber das peças novas do Brechó Bellasu?\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💕`,
    `Olá ${nome}! 🎀✨ Posso te mandar novidades e promoções exclusivas do brechó?\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💛`,
    `Oi ${nome}! 🌺👒 Quer receber nossas novidades em primeira mão pelo WhatsApp?\nResponda *SIM* para aceitar ou *NÃO* para recusar. 🛍️`,
  ]

  const variacoesLives = [
    `Oi ${nome}! 🎥✨ Posso te avisar quando abrirmos uma live com peças novas?\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💛`,
    `Olá ${nome}! 📱🌟 Quer receber aviso quando tivermos uma live no Brechó Bellasu?\nResponda *SIM* para aceitar ou *NÃO* para recusar. 🎀`,
    `Oi ${nome}! 🎬💫 Posso te chamar nas nossas lives com peças selecionadas?\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💕`,
    `Olá ${nome}! 🛍️✨ Quer saber quando abrirmos uma live com novidades do brechó?\nResponda *SIM* para aceitar ou *NÃO* para recusar. 🌸`,
    `Oi ${nome}! 🎥🌺 Posso te avisar das nossas próximas lives pelo WhatsApp?\nResponda *SIM* para aceitar ou *NÃO* para recusar. 💛`,
  ]

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]

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
