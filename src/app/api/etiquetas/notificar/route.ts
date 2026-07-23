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
    .select("id, me_tracking, cliente_id, notificado_envio, carrier")
    .eq("id", etiqueta_id)
    .single()

  if (!etiqueta) return NextResponse.json({ erro: "Etiqueta não encontrada. Ela pode ter sido cancelada." }, { status: 404 })
  if (!etiqueta.me_tracking) return NextResponse.json({ erro: "Etiqueta sem código de rastreio." }, { status: 400 })
  if (!etiqueta.cliente_id) return NextResponse.json({ erro: "Etiqueta sem cliente vinculado." }, { status: 400 })

  const { data: cliente } = await sb
    .from("clientes")
    .select("nome, celular")
    .eq("id", etiqueta.cliente_id)
    .single()

  if (!cliente?.celular) return NextResponse.json({ erro: "Cliente sem celular." }, { status: 400 })

  const carrier = (etiqueta.carrier ?? "melhorenvio") as "melhorenvio" | "superfrete"
  const nome = cliente.nome?.split(" ")[0] ?? "Cliente"
  const codigo = etiqueta.me_tracking
  const linkRastreio = carrier === "superfrete"
    ? `https://superfrete.com/rastreio/${codigo}`
    : `https://melhorrastreio.com.br/rastreio/${codigo}`

  const mensagem = `Oi ${nome}! 📦\n\nSeu pedido foi enviado! Acompanhe aqui:\n${linkRastreio}\n\nCódigo de rastreio: *${codigo}*`

  const resultado = await enviarTexto(cliente.celular, mensagem, "rastreio_envio")

  if (resultado.ok) {
    await sb.from("etiquetas")
      .update({ notificado_envio: true, ultimo_status: "postado" })
      .eq("id", etiqueta_id)
  }

  return NextResponse.json({ ok: resultado.ok, erro: resultado.erro })
})
