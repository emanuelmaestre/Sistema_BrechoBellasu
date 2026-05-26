import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

function fmtData(d: string | null) {
  if (!d) return "—"
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR")
}

function fmtVal(v: unknown) {
  return "R$ " + parseFloat(String(v ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
}

function prazo48h() {
  const dias = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"]
  const d = new Date()
  d.setHours(d.getHours() + 48)
  return dias[d.getDay()]
}

// ─── Gera ou reutiliza link Asaas ─────────────────────────
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

    // 2. Cria cobrança com vencimento em 2 dias (48h)
    const vencimento = new Date()
    vencimento.setDate(vencimento.getDate() + 2)
    const dueDate = vencimento.toISOString().split("T")[0]

    const cobranca = await fetch(`${base}/payments`, {
      method: "POST",
      headers: { access_token: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: "UNDEFINED", // PIX ou Cartão — cliente escolhe
        value: params.valor,
        dueDate,
        description: params.descricao,
      }),
    })

    if (!cobranca.ok) return null
    const pd = await cobranca.json()
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
  const sb = createServerClient()

  const { data: liveData } = await sb.from("lives").select("data_live").eq("id", live_id).single()

  const { data: compras, error } = await sb
    .from("v_live_compras").select("*").eq("live_id", live_id).in("msg_status", ["pendente", "erro"])

  if (error) return NextResponse.json({ erro: "Erro ao buscar compras." }, { status: 500 })
  if (!compras?.length) return NextResponse.json({ ok: true, enviadas: 0, mensagem: "Nenhuma compra pendente." })

  // Busca CPFs dos clientes de uma vez
  const clienteIds = compras.map(c => c.cliente_id).filter(Boolean)
  const cpfMap: Record<number, string | null> = {}
  if (clienteIds.length > 0) {
    const { data: clientes } = await sb.from("clientes").select("id, cpf_cnpj").in("id", clienteIds)
    clientes?.forEach(c => { cpfMap[c.id] = c.cpf_cnpj ?? null })
  }

  const zapiInstance    = process.env.ZAPI_INSTANCE_ID
  const zapiToken       = process.env.ZAPI_TOKEN
  const zapiClientToken = process.env.ZAPI_CLIENT_TOKEN
  const resultados: Array<{ id: number; cliente: string; numero: string; status: string; detalhe?: string }> = []

  for (const compra of compras) {
    const numero = (compra.whatsapp || "").replace(/\D/g, "")
    if (!numero) {
      await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compra.id)
      resultados.push({ id: compra.id, cliente: compra.nome_cliente, numero: "", status: "erro", detalhe: "Sem WhatsApp" })
      continue
    }

    // ── Garante que sempre há link Asaas ──
    let linkPagamento: string = compra.link_pagamento || ""
    if (!linkPagamento) {
      const valorFinal = parseFloat(String(compra.valor_total ?? 0)) - parseFloat(String(compra.desconto ?? 0))
      if (valorFinal > 0) {
        const sacola = [compra.cor_sacola, compra.numero_sacola ? `#${compra.numero_sacola}` : ""].filter(Boolean).join(" ")
        const cpf = compra.cliente_id ? (cpfMap[compra.cliente_id] ?? null) : null
        const link = await gerarLinkAsaas({
          nome: compra.nome_cliente,
          cpf,
          valor: valorFinal,
          descricao: `Compra Live${sacola ? ` — Sacola ${sacola}` : ""}`,
        })
        if (link) {
          linkPagamento = link
          await sb.from("live_compras").update({ link_pagamento: link }).eq("id", compra.id)
        }
      }
    }

    const diaPrazo = prazo48h()
    const mensagem = `Olá! 💖

Obrigada pela sua participação em nossa live. Suas peças foram separadas com carinho. 🛍️

*Resumo da sua compra:*

📅 Data da compra: ${fmtData(compra.data_compra)}
🎥 Data da live: ${fmtData(liveData?.data_live ?? null)}
🛍️ Sacola: ${compra.numero_sacola || "—"}
🎨 Cor da Sacola: ${compra.cor_sacola || "—"}
📦 Quantidade de Itens: ${compra.quantidade_itens || 1}
💰 Valor total: ${fmtVal(compra.valor_total)}

*Pagamento:*

O pagamento deve ser realizado até ${diaPrazo} às 23:59, via PIX ou Cartão, para manter suas peças reservadas com carinho. 💖

💳 Link para pagamento:
${linkPagamento || "[link indisponível — entre em contato]"}

*Endereço para retirada:*

📍 Rua Barão do Amazonas, 1035 - Centro - Rib. Preto - SP

*Entrega:*

Caso queira receber por entrega, envie seu endereço completo e CEP.
O valor fixo da entrega é de R$ 15,00. 🛵

⚠️ *ATENÇÃO*
É NECESSÁRIO TER ALGUÉM NO LOCAL PARA RECEBER O PEDIDO. CASO CONTRÁRIO, SERÁ COBRADA UMA NOVA TAXA PARA RETORNO. SE PREFERIR, VOCÊ PODE OPTAR PELA RETIRADA OU ENTREGA POR CONTA PRÓPRIA.

⚠️ *Importante:*
Peças de promoção não possuem troca.

Obrigada novamente pela sua compra. Espero que goste de tudo! 💖`

    let statusEnvio = "enviada"

    try {
      if (zapiInstance && zapiToken && zapiClientToken) {
        const numFormatado = numero.length === 11 ? `55${numero}` : numero
        const resp = await fetch(
          `https://api.z-api.io/instances/${zapiInstance}/token/${zapiToken}/send-text`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "Client-Token": zapiClientToken },
            body: JSON.stringify({ phone: numFormatado, message: mensagem }),
          }
        )
        if (!resp.ok) {
          statusEnvio = "erro"
          resultados.push({ id: compra.id, cliente: compra.nome_cliente, numero, status: "erro" })
          await sb.from("live_compras").update({ msg_status: "erro", msg_texto: mensagem }).eq("id", compra.id)
          continue
        }
      }
    } catch { statusEnvio = "erro" }

    await sb.from("live_compras").update({
      msg_status: statusEnvio, msg_enviada_em: new Date().toISOString(), msg_texto: mensagem,
    }).eq("id", compra.id)

    resultados.push({ id: compra.id, cliente: compra.nome_cliente, numero, status: statusEnvio })
  }

  const todosOk = resultados.every(r => r.status === "enviada")
  if (todosOk) await sb.from("lives").update({ status: "disparada" }).eq("id", live_id)

  return NextResponse.json({
    ok: true,
    enviadas: resultados.filter(r => r.status === "enviada").length,
    erros: resultados.filter(r => r.status === "erro").length,
    resultados,
  })
}
