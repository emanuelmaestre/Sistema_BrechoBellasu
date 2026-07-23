import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { enviarTexto } from "@/lib/zapi"

export const dynamic = "force-dynamic"

// POST /api/etiquetas/notificar — Envia link de rastreio via WhatsApp
export const POST = withAuth(async (req: NextRequest) => {
  const { etiqueta_id } = await req.json()
  const sb = createServerClient()

  const { data: etiqueta } = await sb
    .from("etiquetas")
    .select("id, rastreio, cliente_id, notificado_envio, carrier")
    .eq("id", etiqueta_id)
    .single()

  if (!etiqueta) return NextResponse.json({ erro: "Etiqueta não encontrada. Ela pode ter sido cancelada." }, { status: 404 })
  if (!etiqueta.rastreio) return NextResponse.json({ erro: "Etiqueta sem código de rastreio." }, { status: 400 })
  if (!etiqueta.cliente_id) return NextResponse.json({ erro: "Etiqueta sem cliente vinculado." }, { status: 400 })

  const { data: cliente } = await sb
    .from("clientes")
    .select("nome, celular")
    .eq("id", etiqueta.cliente_id)
    .single()

  if (!cliente?.celular) return NextResponse.json({ erro: "Cliente sem celular." }, { status: 400 })

  const carrier = (etiqueta.carrier ?? "melhorenvio") as "melhorenvio" | "superfrete"
  const nome = cliente.nome?.split(" ")[0] ?? "Cliente"
  const linkRastreio = carrier === "superfrete"
    ? `https://superfrete.com/rastreio/${etiqueta.rastreio}`
    : `https://melhorrastreio.com.br/rastreio/${etiqueta.rastreio}`

  const mensagem = `Oi ${nome}! 📦\n\nSeu pedido foi enviado! Acompanhe aqui:\n${linkRastreio}\n\nCódigo de rastreio: *${etiqueta.rastreio}*`

  const resultado = await enviarTexto(cliente.celular, mensagem, "rastreio_envio")

  if (resultado.ok) {
    await sb.from("etiquetas")
      .update({ notificado_envio: true, ultimo_status: "postado" })
      .eq("id", etiqueta_id)
  }

  return NextResponse.json({ ok: resultado.ok, erro: resultado.erro })
})
