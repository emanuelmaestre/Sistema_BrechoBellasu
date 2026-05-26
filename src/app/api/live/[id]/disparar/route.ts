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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const live_id = parseInt(id)
  const sb = createServerClient()

  // Busca dados da live (data) para incluir na mensagem
  const { data: liveData } = await sb.from("lives").select("data_live").eq("id", live_id).single()

  const { data: compras, error } = await sb
    .from("v_live_compras").select("*").eq("live_id", live_id).in("msg_status", ["pendente", "erro"])

  if (error) return NextResponse.json({ erro: "Erro ao buscar compras." }, { status: 500 })
  if (!compras?.length) return NextResponse.json({ ok: true, enviadas: 0, mensagem: "Nenhuma compra pendente." })

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

    const linkPagamento = compra.link_pagamento || ""
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

O pagamento deve ser realizado até segunda-feira às 23:59, via PIX ou Cartão, para manter suas peças reservadas com carinho. 💖

💳 Link para pagamento:
${linkPagamento || "[link será gerado em breve]"}

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
