import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const live_id = parseInt(id)
  const body = await req.json()
  const { cliente_id, nome_cliente, whatsapp, data_compra, cor_sacola, numero_sacola, quantidade_itens, quantidade_volumes, valor_total, desconto, observacao, link_pagamento, itens } = body

  let nomeCliente = nome_cliente
  let whatsappCliente = whatsapp

  const sb = createServerClient()
  if (cliente_id) {
    const { data: cli } = await sb.from("clientes").select("nome, celular").eq("id", cliente_id).single()
    if (cli) {
      nomeCliente = nomeCliente || cli.nome
      whatsappCliente = whatsappCliente || cli.celular
    }
  }

  const { data: compra, error } = await sb.from("live_compras").insert({
    live_id, cliente_id: cliente_id ?? null, nome_cliente: nomeCliente, whatsapp: whatsappCliente,
    data_compra: data_compra ?? new Date().toISOString().split("T")[0],
    cor_sacola, numero_sacola, quantidade_itens: quantidade_itens ?? 1,
    quantidade_volumes: quantidade_volumes ?? 1,
    valor_total: valor_total ?? 0, desconto: desconto ?? 0,
    observacao: observacao ?? null,
    link_pagamento: link_pagamento ?? null,
  }).select().single()

  if (error) return NextResponse.json({ erro: "Erro ao registrar compra." }, { status: 500 })

  if (itens?.length) {
    const rows = itens.map((it: Record<string, unknown>) => ({
      compra_id: compra.id, produto_id: it.produto_id ?? null,
      nome_produto: it.nome_produto, quantidade: it.quantidade ?? 1,
      preco_unitario: it.preco_unitario ?? 0, desconto_item: it.desconto_item ?? 0,
      eh_live: it.eh_live !== false,
    }))
    await sb.from("live_compra_itens").insert(rows)
  }

  return NextResponse.json(compra, { status: 201 })
}
