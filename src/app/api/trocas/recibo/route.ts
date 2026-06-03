import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { enviarDocumento } from "@/lib/zapi"

export const dynamic = "force-dynamic"

// POST /api/trocas/recibo
// Body: { trocaId: number, pdfBase64: string, reenviar?: boolean }
export const POST = withAuth(async (req: NextRequest) => {
  const { trocaId, pdfBase64, reenviar } = await req.json()
  if (!pdfBase64 || !trocaId) return NextResponse.json({ erro: "Dados incompletos." }, { status: 400 })

  const sb = createServerClient()

  // 1. Busca troca + status de notificação
  const { data: troca, error } = await sb
    .from("trocas")
    .select("*, clientes(nome, celular)")
    .eq("id", trocaId)
    .single()

  if (error || !troca) return NextResponse.json({ erro: "Troca não encontrada." }, { status: 404 })

  // 2. Bloqueia reenvio se já enviado (regras 11 e 12)
  if (reenviar && troca.notificacao_status === "enviado") {
    return NextResponse.json({ erro: "Recibo já foi enviado com sucesso. Não é necessário reenviar." }, { status: 409 })
  }

  const cliente = troca.clientes as { nome: string; celular: string } | null
  if (!cliente?.celular) return NextResponse.json({ erro: "Cliente sem celular cadastrado." }, { status: 400 })

  // 3. Marca como PENDENTE antes de enviar
  await sb.from("trocas").update({ notificacao_status: "pendente" }).eq("id", trocaId)

  // 4. Upload temporário no Storage
  const fileName = `recibo-troca-${trocaId}-${Date.now()}.pdf`
  const pdfBuffer = Buffer.from(pdfBase64, "base64")

  const { error: upErr } = await sb.storage
    .from("recibos")
    .upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: true })

  if (upErr) {
    await sb.from("trocas").update({ notificacao_status: "erro" }).eq("id", trocaId)
    return NextResponse.json({ erro: `Erro ao salvar PDF: ${upErr.message}` }, { status: 500 })
  }

  // 5. URL assinada (1 hora)
  const { data: urlData } = await sb.storage.from("recibos").createSignedUrl(fileName, 3600)
  if (!urlData?.signedUrl) {
    await sb.from("trocas").update({ notificacao_status: "erro" }).eq("id", trocaId)
    return NextResponse.json({ erro: "Erro ao gerar URL do PDF." }, { status: 500 })
  }

  // 6. Envia via Z-API
  const tipo = troca.tipo === "devolucao" ? "Devolução" : "Troca"
  const caption = `🔄 *${tipo} — Brechó Bellasu*\n#${trocaId} · Olá, ${cliente.nome.split(" ")[0]}! Segue o comprovante 💛`
  const resultado = await enviarDocumento(
    cliente.celular,
    urlData.signedUrl,
    `Recibo-${tipo}-Bellasu-${trocaId}.pdf`,
    caption,
    "troca_aprovada",
  )

  // 7. Deleta do Storage
  await sb.storage.from("recibos").remove([fileName])

  // 8. Atualiza status
  await sb.from("trocas")
    .update({ notificacao_status: resultado.ok ? "enviado" : "erro" })
    .eq("id", trocaId)

  if (!resultado.ok) {
    return NextResponse.json(
      { erro: `Falha ao enviar WhatsApp: ${resultado.erro}`, notificacao_status: "erro" },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, enviado: true, notificacao_status: "enviado", messageId: resultado.messageId })
})
