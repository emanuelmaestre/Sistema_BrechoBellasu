import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

// ─── Gera cobrança no Asaas e retorna o link de pagamento ─
async function gerarLinkAsaas(params: {
  nome: string
  cpf?: string | null
  valor: number
  descricao: string
}): Promise<string | null> {
  const token = process.env.ASAAS_TOKEN
  if (!token) return null

  const base = process.env.ASAAS_URL ?? "https://api.asaas.com/v3"

  try {
    // 1. Busca ou cria cliente no Asaas
    let asaasCustomerId: string | null = null

    if (params.cpf) {
      const busca = await fetch(`${base}/customers?cpfCnpj=${params.cpf.replace(/\D/g, "")}`, {
        headers: { access_token: token, "Content-Type": "application/json" },
      })
      if (busca.ok) {
        const bd = await busca.json()
        if (bd.data?.length > 0) asaasCustomerId = bd.data[0].id
      }
    }

    if (!asaasCustomerId) {
      const criar = await fetch(`${base}/customers`, {
        method: "POST",
        headers: { access_token: token, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: params.nome,
          cpfCnpj: params.cpf?.replace(/\D/g, "") || undefined,
        }),
      })
      if (criar.ok) {
        const cd = await criar.json()
        asaasCustomerId = cd.id
      }
    }

    if (!asaasCustomerId) return null

    // 2. Cria cobrança com vencimento em 2 dias
    const vencimento = new Date()
    vencimento.setDate(vencimento.getDate() + 2)
    const dueDate = vencimento.toISOString().split("T")[0]

    const cobranca = await fetch(`${base}/payments`, {
      method: "POST",
      headers: { access_token: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: "UNDEFINED", // permite PIX ou Cartão
        value: params.valor,
        dueDate,
        description: params.descricao,
      }),
    })

    if (!cobranca.ok) return null
    const pd = await cobranca.json()

    // 3. Retorna o link de pagamento
    return pd.invoiceUrl ?? pd.bankSlipUrl ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const live_id = parseInt(id)
  const body = await req.json()
  const { cliente_id, nome_cliente, whatsapp, data_compra, cor_sacola, numero_sacola, quantidade_itens, quantidade_volumes, valor_total, desconto, observacao, itens } = body

  let nomeCliente = nome_cliente
  let whatsappCliente = whatsapp
  let cpfCliente: string | null = null

  const sb = createServerClient()
  if (cliente_id) {
    const { data: cli } = await sb.from("clientes").select("nome, celular, cpf_cnpj").eq("id", cliente_id).single()
    if (cli) {
      nomeCliente = nomeCliente || cli.nome
      whatsappCliente = whatsappCliente || cli.celular
      cpfCliente = cli.cpf_cnpj ?? null
    }
  }

  // ── Insere a compra primeiro ──
  const { data: compra, error } = await sb.from("live_compras").insert({
    live_id, cliente_id: cliente_id ?? null, nome_cliente: nomeCliente, whatsapp: whatsappCliente,
    data_compra: data_compra ?? new Date().toISOString().split("T")[0],
    cor_sacola, numero_sacola, quantidade_itens: quantidade_itens ?? 1,
    quantidade_volumes: quantidade_volumes ?? 1,
    valor_total: valor_total ?? 0, desconto: desconto ?? 0,
    observacao: observacao ?? null,
    link_pagamento: null,
  }).select().single()

  if (error) return NextResponse.json({ erro: "Erro ao registrar compra." }, { status: 500 })

  // ── Gera link Asaas automaticamente ──
  const valorFinal = parseFloat(String(valor_total ?? 0)) - parseFloat(String(desconto ?? 0))
  if (valorFinal > 0) {
    const sacola = [cor_sacola, numero_sacola ? `#${numero_sacola}` : ""].filter(Boolean).join(" ")
    const link = await gerarLinkAsaas({
      nome: nomeCliente,
      cpf: cpfCliente,
      valor: valorFinal,
      descricao: `Compra Live${sacola ? ` — Sacola ${sacola}` : ""}`,
    })
    if (link) {
      await sb.from("live_compras").update({ link_pagamento: link }).eq("id", compra.id)
      compra.link_pagamento = link
    }
  }

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
