import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { gerarLinkAsaas } from "@/lib/asaas"
import { enviarTexto } from "@/lib/zapi"
// consultarPagamentoAsaas importado mas não usado no disparo — usado no sync

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const live_id = parseInt(id)
  const sb = createServerClient()

  // Busca dados da live (data + tipo — coluna tipo pode não existir ainda)
  const { data: liveRow } = await sb.from("lives").select("data_live, tipo").eq("id", live_id).single()
  const tipoLive = ((liveRow as Record<string,unknown>)?.tipo ?? "novidades") as "novidades" | "promocional"

  // Busca endereço de retirada das configurações da empresa
  const { data: configEmpresa } = await sb.from("configuracoes").select("valor").eq("chave", "empresa").maybeSingle()
  const empresa = (configEmpresa?.valor ?? {}) as Record<string, string>
  const enderecoRetirada = [
    empresa.logradouro,
    empresa.numero,
    empresa.bairro,
    empresa.cidade,
    empresa.estado,
  ].filter(Boolean).join(", ") || "Rua Barão do Amazonas, 1035 - Centro - Rib. Preto - SP"
  const taxaEntrega = empresa.taxa_entrega || "15,00"

  // Busca todas as compras da live e filtra em JS (evita problema com NULL no PostgREST)
  const { data: todasCompras } = await sb
    .from("live_compras").select("*").eq("live_id", live_id)

  const compras = (todasCompras ?? []).filter((c: Record<string, unknown>) =>
    !c.msg_status || c.msg_status === "pendente" || c.msg_status === "erro"
  )

  if (!compras.length) return NextResponse.json({ ok: true, enviadas: 0, mensagem: "Nenhuma compra pendente." })

  // Busca CPFs dos clientes de uma vez
  const clienteIds = compras.map((c: Record<string, unknown>) => c.cliente_id).filter(Boolean)
  const cpfMap: Record<number, string | null> = {}
  if (clienteIds.length > 0) {
    const { data: clientes } = await sb.from("clientes").select("id, cpf_cnpj").in("id", clienteIds)
    clientes?.forEach((c: { id: number; cpf_cnpj?: string | null }) => { cpfMap[c.id] = c.cpf_cnpj ?? null })
  }

  const resultados: Array<{ id: number; cliente: string; numero: string; status: string; detalhe?: string }> = []

  for (const compra of compras) {
    const numero = (compra.whatsapp || "").replace(/\D/g, "")
    if (!numero) {
      const { error: e1 } = await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compra.id)
      if (e1) console.error(`[LIVE] Erro update sem-whatsapp compra #${compra.id}:`, e1.message)
      resultados.push({ id: compra.id, cliente: compra.nome_cliente, numero: "", status: "erro", detalhe: "Sem WhatsApp" })
      continue
    }

    // ── Garante link Asaas sempre presente ──
    let linkPagamento: string = compra.link_pagamento || ""
    if (!linkPagamento) {
      const valorFinal = parseFloat(String(compra.valor_total ?? 0)) - parseFloat(String(compra.desconto ?? 0))
      if (valorFinal > 0) {
        const sacola = [compra.cor_sacola, compra.numero_sacola ? `#${compra.numero_sacola}` : ""].filter(Boolean).join(" ")
        const cpf = compra.cliente_id ? (cpfMap[compra.cliente_id] ?? null) : null
        const resultado = await gerarLinkAsaas({
          nome: compra.nome_cliente,
          cpf,
          valor: valorFinal,
          descricao: `Compra Live${sacola ? ` — Sacola ${sacola}` : ""}`,
          tipoLive,
        })
        if (resultado) {
          linkPagamento = resultado.url
          const upd: Record<string, unknown> = { link_pagamento: resultado.url, pagamento_status: "EM_ABERTO" }
          try { await sb.from("live_compras").update({ ...upd, asaas_payment_id: resultado.paymentId }).eq("id", compra.id) }
          catch { await sb.from("live_compras").update(upd).eq("id", compra.id) }
        }
      }
    }

    const diaPrazo = prazo48h()
    const obsCartao = tipoLive === "promocional"
      ? "\n\n⚠️ *Atenção:* pagamento via cartão de crédito sujeito a juros por conta do cliente."
      : ""

    const mensagem = `Olá! 💖

Obrigada pela sua participação em nossa live. Suas peças foram separadas com carinho. 🛍️

*Resumo da sua compra:*

📅 Data da compra: ${fmtData(compra.data_compra)}
🎥 Data da live: ${fmtData(liveRow?.data_live ?? null)}
🛍️ Sacola: ${compra.numero_sacola || "—"}
🎨 Cor da Sacola: ${compra.cor_sacola || "—"}
📦 Quantidade de Itens: ${compra.quantidade_itens || 1}
💰 Valor total: ${fmtVal(compra.valor_total)}

*Pagamento:*

O pagamento deve ser realizado até ${diaPrazo} às 23:59, via PIX ou Cartão de Crédito, para manter suas peças reservadas com carinho. 💖${obsCartao}

💳 Link para pagamento:
${linkPagamento || "[link indisponível — entre em contato]"}

*Endereço para retirada:*

📍 ${enderecoRetirada}

*Entrega:*

Caso queira receber por entrega, envie seu endereço completo e CEP.
O valor fixo da entrega é de R$ ${taxaEntrega}. 🛵

⚠️ *ATENÇÃO*
É NECESSÁRIO TER ALGUÉM NO LOCAL PARA RECEBER O PEDIDO. CASO CONTRÁRIO, SERÁ COBRADA UMA NOVA TAXA PARA RETORNO. SE PREFERIR, VOCÊ PODE OPTAR PELA RETIRADA OU ENTREGA POR CONTA PRÓPRIA.

⚠️ *Importante:*
Peças de promoção não possuem troca.

Obrigada novamente pela sua compra. Espero que goste de tudo! 💖`

    let statusEnvio = "enviada"

    try {
      const resultado = await enviarTexto(numero, mensagem, "aviso_live")
      if (!resultado.ok) {
        statusEnvio = "erro"
        resultados.push({ id: compra.id, cliente: compra.nome_cliente, numero, status: "erro", detalhe: resultado.erro ?? "Falha Z-API" })
        await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compra.id)
        continue
      }
    } catch { statusEnvio = "erro" }

    // ── UPDATE msg_status — múltiplas tentativas ──
    let updateOk = false
    let debugInfo = ""

    // Tentativa 1: update simples só msg_status (campo crítico)
    const { data: upd1, error: err1 } = await sb
      .from("live_compras").update({ msg_status: statusEnvio }).eq("id", compra.id).select("id, msg_status")
    if (err1) {
      debugInfo += `T1 err: ${err1.message}. `
      console.error(`[LIVE] T1 falhou compra #${compra.id}:`, err1.message, err1.details ?? "")
    } else if (upd1?.length && upd1[0].msg_status === statusEnvio) {
      updateOk = true
      debugInfo += `T1 ok. `
    } else {
      debugInfo += `T1 retornou ${JSON.stringify(upd1)}. `
      console.error(`[LIVE] T1 não persistiu compra #${compra.id}:`, upd1)
    }

    // Tentativa 2: REST direto ao PostgREST (bypassa qualquer cache do client)
    if (!updateOk) {
      try {
        const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const restResp = await fetch(
          `${supaUrl}/rest/v1/live_compras?id=eq.${compra.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "apikey": supaKey!,
              "Authorization": `Bearer ${supaKey}`,
              "Prefer": "return=representation",
            },
            body: JSON.stringify({ msg_status: statusEnvio }),
          }
        )
        const restBody = await restResp.text()
        if (restResp.ok) {
          updateOk = true
          debugInfo += `T2-REST ok (${restResp.status}). `
        } else {
          debugInfo += `T2-REST falhou: ${restResp.status} ${restBody.substring(0, 200)}. `
          console.error(`[LIVE] T2-REST falhou compra #${compra.id}: ${restResp.status}`, restBody.substring(0, 300))
        }
      } catch (restErr: unknown) {
        debugInfo += `T2-REST exc: ${restErr instanceof Error ? restErr.message : String(restErr)}. `
      }
    }

    // Campos extras (não-críticos) — tenta separado, ignora falha
    if (updateOk) {
      try {
        await sb.from("live_compras").update({ msg_enviada_em: new Date().toISOString(), msg_texto: mensagem }).eq("id", compra.id)
      } catch { /* ignora — campos opcionais */ }
    }

    // Verificação final: lê o registro pra confirmar
    if (updateOk) {
      const { data: check } = await sb.from("live_compras").select("msg_status").eq("id", compra.id).single()
      if (check?.msg_status !== statusEnvio) {
        updateOk = false
        debugInfo += `VERIFY falhou: lido=${check?.msg_status}. `
        console.error(`[LIVE] VERIFY falhou compra #${compra.id}: esperado=${statusEnvio}, lido=${check?.msg_status}`)
      }
    }

    if (!updateOk) statusEnvio = "erro"

    resultados.push({ id: compra.id, cliente: compra.nome_cliente, numero, status: statusEnvio, detalhe: debugInfo || undefined })
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
