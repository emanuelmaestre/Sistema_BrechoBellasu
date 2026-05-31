import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { enviarTexto } from "@/lib/zapi"

export const dynamic = "force-dynamic"

// POST /api/vendas/[id]/recibo — Gera e envia recibo via WhatsApp
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const vendaId = parseInt(id)
  const sb = createServerClient()

  // 1. Busca dados da venda
  const { data: venda, error: errVenda } = await sb
    .from("v_vendas")
    .select("*")
    .eq("id", vendaId)
    .single()
  if (errVenda || !venda) return NextResponse.json({ erro: "Venda não encontrada." }, { status: 404 })

  // 2. Busca itens da venda
  const { data: itens } = await sb
    .from("venda_itens")
    .select("nome, qtd, preco_unit, subtotal")
    .eq("venda_id", vendaId)

  // 3. Busca celular do cliente
  if (!venda.cliente_id) return NextResponse.json({ erro: "Venda sem cliente vinculado." }, { status: 400 })

  const { data: cliente } = await sb
    .from("clientes")
    .select("nome, celular")
    .eq("id", venda.cliente_id)
    .single()
  if (!cliente?.celular) return NextResponse.json({ erro: "Cliente sem celular cadastrado." }, { status: 400 })

  // 4. Monta mensagem de recibo em texto
  const dataVenda = new Date(venda.created_at).toLocaleDateString("pt-BR")
  const listaItens = (itens ?? [])
    .map((it: { nome: string; qtd: number; preco_unit: number; subtotal: number }) =>
      `• ${it.qtd}x ${it.nome} — R$ ${Number(it.subtotal).toFixed(2).replace(".", ",")}`)
    .join("\n")

  const total = Number(venda.total).toFixed(2).replace(".", ",")
  const desconto = Number(venda.desconto || 0).toFixed(2).replace(".", ",")

  let mensagem = `✅ *RECIBO — Brechó Bellasu*\n\n`
  mensagem += `📅 Data: ${dataVenda}\n`
  mensagem += `👤 Cliente: ${cliente.nome}\n\n`
  mensagem += `📦 *Itens:*\n${listaItens}\n\n`
  if (Number(venda.desconto) > 0) {
    mensagem += `🏷️ Desconto: R$ ${desconto}\n`
  }
  mensagem += `💰 *Total: R$ ${total}*\n`
  mensagem += `💳 Pagamento: ${venda.forma_pagamento}\n\n`
  mensagem += `Obrigada pela preferência! 💛`

  // 5. Envia via Z-API
  const resultado = await enviarTexto(cliente.celular, mensagem, "recibo_venda")

  if (!resultado.ok) {
    return NextResponse.json(
      { erro: `Falha ao enviar WhatsApp: ${resultado.erro}`, enviado: false },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, enviado: true, messageId: resultado.messageId })
}
