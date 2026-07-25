import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { enviarTexto, enviarImagem, enviarVideo } from "@/lib/zapi"
import { buildBroadcastMessage } from "@/lib/broadcast-message-builder"

// GET — retorna fila de clientes opt-in + contagem total + estimativa de tempo
export async function GET() {
  const sb = createServerClient()
  const { data, error } = await sb
    .from("clientes")
    .select("id, nome")
    .eq("aceita_novidades", "sim")
    .order("nome")

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  const clientes = data ?? []
  const total = clientes.length

  // Estima duração: intervalo médio de 115s entre envios (80–150s)
  const duracaoMinMin = total <= 1 ? 0 : Math.ceil((total - 1) * 80  / 60)
  const duracaoMinMax = total <= 1 ? 0 : Math.ceil((total - 1) * 150 / 60)

  return NextResponse.json({ clientes, total, duracaoMinMin, duracaoMinMax })
}

// POST — dispara mensagem para UM cliente (chamado sequencialmente pelo store)
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    campanha_id: number
    cliente_id:  number
  }

  if (!body.campanha_id || !body.cliente_id) {
    return NextResponse.json({ erro: "campanha_id e cliente_id são obrigatórios." }, { status: 400 })
  }

  const sb = createServerClient()

  // Busca campanha
  const { data: camp, error: campErr } = await sb
    .from("campanhas")
    .select("*")
    .eq("id", body.campanha_id)
    .single()

  if (campErr || !camp) {
    return NextResponse.json({ erro: "Campanha não encontrada." }, { status: 404 })
  }

  // Busca cliente
  const { data: cliente, error: cliErr } = await sb
    .from("clientes")
    .select("id, nome, celular")
    .eq("id", body.cliente_id)
    .single()

  if (cliErr || !cliente) {
    return NextResponse.json({ status: "erro", detalhe: "Cliente não encontrado.", cliente: "" }, { status: 200 })
  }

  // Monta mensagem com small talk personalizado
  const mensagem = buildBroadcastMessage(cliente.nome, camp.texto)

  let resultado
  if (camp.midia_tipo === "imagem" && camp.midia_url) {
    resultado = await enviarImagem(cliente.celular, camp.midia_url, mensagem, "broadcast")
  } else if (camp.midia_tipo === "video" && camp.midia_url) {
    resultado = await enviarVideo(cliente.celular, camp.midia_url, mensagem, "broadcast")
  } else {
    resultado = await enviarTexto(cliente.celular, mensagem, "broadcast")
  }

  // Atualiza stats da campanha atomicamente
  try {
    if (resultado.ok) {
      await sb.rpc("campanha_inc_enviadas", { p_id: body.campanha_id })
    } else {
      await sb.rpc("campanha_inc_erros", { p_id: body.campanha_id })
    }
  } catch { /* não bloqueia o retorno */ }

  return NextResponse.json({
    status:  resultado.ok ? "enviada" : "erro",
    detalhe: resultado.erro ?? resultado.messageId ?? "",
    cliente: cliente.nome,
  })
}
