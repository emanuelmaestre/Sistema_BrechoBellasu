import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { dispararDocumentoUnico } from "@/lib/disparo-controlado"

export const dynamic = "force-dynamic"

// POST /api/vendas/[id]/recibo
// Body: { pdfBase64: string, reenviar?: boolean }
// - reenviar: true → força reenvio manual (bloqueado se já ENVIADO)
// - reenviar: false/ausente → envio automático (ao criar venda)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const vendaId = parseInt(id)
  const sb = createServerClient()

  const body = await req.json()
  const { pdfBase64, reenviar } = body

  if (!pdfBase64) return NextResponse.json({ erro: "PDF não enviado." }, { status: 400 })

  // 1. Busca dados da venda (inclui notificacao_status)
  const { data: venda, error: errVenda } = await sb
    .from("vendas")
    .select("id, cliente_id, notificacao_status")
    .eq("id", vendaId)
    .single()
  if (errVenda || !venda) return NextResponse.json({ erro: "Venda não encontrada." }, { status: 404 })

  // 2. Bloqueia reenvio se já enviado (regra 7 e 8)
  if (reenviar && venda.notificacao_status === "enviado") {
    return NextResponse.json({ erro: "Recibo já foi enviado com sucesso. Não é necessário reenviar." }, { status: 409 })
  }

  // 3. Busca dados completos da venda para o recibo
  const { data: vendaCompleta } = await sb.from("v_vendas").select("*").eq("id", vendaId).single()
  if (!vendaCompleta) return NextResponse.json({ erro: "Dados da venda não encontrados." }, { status: 404 })

  // 4. Busca celular do cliente
  if (!venda.cliente_id) return NextResponse.json({ erro: "Venda sem cliente vinculado." }, { status: 400 })
  const { data: cliente } = await sb.from("clientes").select("nome, celular").eq("id", venda.cliente_id).single()
  if (!cliente?.celular) return NextResponse.json({ erro: "Cliente sem celular cadastrado." }, { status: 400 })

  // 5. Marca como PENDENTE antes de tentar enviar
  await sb.from("vendas").update({ notificacao_status: "pendente" }).eq("id", vendaId)

  // 6. Upload do PDF para Supabase Storage (temporário)
  const fileName = `recibo-venda-${vendaId}-${Date.now()}.pdf`
  const pdfBuffer = Buffer.from(pdfBase64, "base64")

  const { error: upErr } = await sb.storage
    .from("recibos")
    .upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: true })

  if (upErr) {
    await sb.from("vendas").update({ notificacao_status: "erro" }).eq("id", vendaId)
    return NextResponse.json({ erro: `Erro ao salvar PDF: ${upErr.message}` }, { status: 500 })
  }

  // 7. Gera URL pública temporária (1 hora)
  const { data: urlData } = await sb.storage.from("recibos").createSignedUrl(fileName, 3600)
  if (!urlData?.signedUrl) {
    await sb.from("vendas").update({ notificacao_status: "erro" }).eq("id", vendaId)
    return NextResponse.json({ erro: "Erro ao gerar URL do PDF." }, { status: 500 })
  }

  // 8. Envia via Z-API como documento
  const caption = `✅ *Recibo — Brechó Bellasu*\nVenda #${vendaId} · Olá, ${cliente.nome.split(" ")[0]}! Segue seu recibo 💛`
  const resultado = await dispararDocumentoUnico({
    clienteId: venda.cliente_id,
    nome:      cliente.nome,
    telefone:  cliente.celular,
    docUrl:    urlData.signedUrl,
    docNome:   `Recibo-Bellasu-${vendaId}.pdf`,
    caption,
    tipo:      "recibo_venda",
    modulo:    "VENDAS",
  })

  // 9. Deleta o arquivo do Storage após envio
  await sb.storage.from("recibos").remove([fileName])

  // 10. Atualiza status conforme resultado
  await sb.from("vendas")
    .update({ notificacao_status: resultado.ok ? "enviado" : "erro" })
    .eq("id", vendaId)

  if (!resultado.ok) {
    return NextResponse.json(
      { erro: `Falha ao enviar WhatsApp: ${resultado.erro}`, enviado: false, notificacao_status: "erro" },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, enviado: true, notificacao_status: "enviado", messageId: resultado.messageId })
}
