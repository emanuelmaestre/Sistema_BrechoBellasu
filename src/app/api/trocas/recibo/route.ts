import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { enviarDocumento } from "@/lib/zapi"

export const dynamic = "force-dynamic"

// POST /api/trocas/recibo
// Body: { trocaId: number, pdfBase64: string }
export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { trocaId, pdfBase64 } = await req.json()
  if (!pdfBase64 || !trocaId) return NextResponse.json({ erro: "Dados incompletos." }, { status: 400 })

  const sb = createServerClient()

  // 1. Busca troca + cliente
  const { data: troca, error } = await sb
    .from("trocas")
    .select("*, clientes(nome, celular)")
    .eq("id", trocaId)
    .single()

  if (error || !troca) return NextResponse.json({ erro: "Troca não encontrada." }, { status: 404 })

  const cliente = troca.clientes as { nome: string; celular: string } | null
  if (!cliente?.celular) return NextResponse.json({ erro: "Cliente sem celular cadastrado." }, { status: 400 })

  // 2. Upload temporário no Storage
  const fileName = `recibo-troca-${trocaId}-${Date.now()}.pdf`
  const pdfBuffer = Buffer.from(pdfBase64, "base64")

  const { error: upErr } = await sb.storage
    .from("recibos")
    .upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: true })

  if (upErr) return NextResponse.json({ erro: `Erro ao salvar PDF: ${upErr.message}` }, { status: 500 })

  // 3. URL assinada (1 hora)
  const { data: urlData } = await sb.storage.from("recibos").createSignedUrl(fileName, 3600)
  if (!urlData?.signedUrl) return NextResponse.json({ erro: "Erro ao gerar URL do PDF." }, { status: 500 })

  // 4. Envia via Z-API
  const tipo = troca.tipo === "devolucao" ? "Devolução" : "Troca"
  const caption = `🔄 *${tipo} — Brechó Bellasu*\n#${trocaId} · Olá, ${cliente.nome.split(" ")[0]}! Segue o comprovante 💛`
  const resultado = await enviarDocumento(
    cliente.celular,
    urlData.signedUrl,
    `Recibo-${tipo}-Bellasu-${trocaId}.pdf`,
    caption,
    "troca_aprovada",
  )

  // 5. Deleta do Storage
  await sb.storage.from("recibos").remove([fileName])

  if (!resultado.ok) {
    return NextResponse.json({ erro: `Falha ao enviar WhatsApp: ${resultado.erro}`, enviado: false }, { status: 502 })
  }

  return NextResponse.json({ ok: true, enviado: true, messageId: resultado.messageId })
}
