import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { gerarLinkAsaas } from "@/lib/asaas"
import { enviarTexto } from "@/lib/zapi"
import {
  buildCompleteMessage,
  generateNotificationId,
  type CompraData,
} from "@/lib/live-message-builder"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const live_id = parseInt(id)
  const sb = createServerClient()

  const { data: liveRow } = await sb.from("lives").select("data_live, tipo").eq("id", live_id).single()
  const tipoLive = ((liveRow as Record<string,unknown>)?.tipo ?? "novidades") as "novidades" | "promocional"

  // Busca CPFs dos clientes (necessário para Asaas)
  const { data: todasCompras } = await sb
    .from("live_compras").select("*").eq("live_id", live_id)

  const compras = (todasCompras ?? []).filter((c: Record<string, unknown>) =>
    !c.msg_status || c.msg_status === "pendente" || c.msg_status === "erro"
  )

  if (!compras.length) return NextResponse.json({ ok: true, enviadas: 0, mensagem: "Nenhuma compra pendente." })

  const clienteIds = compras.map((c: Record<string, unknown>) => c.cliente_id).filter(Boolean)
  const cpfMap: Record<number, string | null> = {}
  const nomeMap: Record<number, string | null> = {}
  if (clienteIds.length > 0) {
    const { data: clientes } = await sb.from("clientes").select("id, cpf_cnpj, nome").in("id", clienteIds)
    clientes?.forEach((c: { id: number; cpf_cnpj?: string | null; nome?: string | null }) => {
      cpfMap[c.id] = c.cpf_cnpj ?? null
      nomeMap[c.id] = c.nome ?? null
    })
  }

  const resultados: Array<{ id: number; cliente: string; numero: string; status: string; detalhe?: string }> = []

  for (const compra of compras) {
    const numero = (compra.whatsapp || "").replace(/\D/g, "")
    if (!numero) {
      await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compra.id)
      resultados.push({ id: compra.id, cliente: compra.nome_cliente, numero: "", status: "erro", detalhe: "Sem WhatsApp" })
      continue
    }

    // ── Idempotência: verifica se já foi enviado ──
    const notifId = generateNotificationId(live_id, compra.id)
    try {
      const { data: jaEnviado } = await sb
        .from("whatsapp_log")
        .select("id")
        .eq("notification_id", notifId)
        .eq("status", "enviado")
        .maybeSingle()
      if (jaEnviado) {
        resultados.push({ id: compra.id, cliente: compra.nome_cliente, numero, status: "enviada", detalhe: "já enviado anteriormente" })
        continue
      }
    } catch { /* se coluna ainda não existe, ignora */ }

    // ── Garante link Asaas ──
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

    // ── Monta mensagem via builder centralizado ──
    const nomeCliente = compra.cliente_id ? (nomeMap[compra.cliente_id] ?? compra.nome_cliente) : compra.nome_cliente
    const compraData: CompraData = {
      data_compra:      compra.data_compra,
      data_live:        liveRow?.data_live ?? null,
      numero_sacola:    compra.numero_sacola,
      cor_sacola:       compra.cor_sacola,
      quantidade_itens: compra.quantidade_itens,
      valor_total:      compra.valor_total,
      nome_cliente:     nomeCliente,
      link_pagamento:   linkPagamento || null,
    }

    const msgResult = buildCompleteMessage(compraData)

    if (!msgResult.valida) {
      await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compra.id)
      resultados.push({ id: compra.id, cliente: compra.nome_cliente, numero, status: "erro", detalhe: msgResult.erro })
      continue
    }

    const mensagem = msgResult.mensagem
    let statusEnvio = "enviada"

    try {
      const resultado = await enviarTexto(numero, mensagem, "aviso_live")
      if (!resultado.ok) {
        statusEnvio = "erro"
        resultados.push({ id: compra.id, cliente: compra.nome_cliente, numero, status: "erro", detalhe: resultado.erro ?? "Falha Z-API" })
        await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compra.id)
        continue
      }
      // Registra notification_id para idempotência
      try {
        await sb.from("whatsapp_log")
          .update({ notification_id: notifId })
          .eq("telefone", `55${numero}`)
          .eq("tipo", "aviso_live")
          .order("created_at", { ascending: false })
          .limit(1)
      } catch { /* ignora — campo opcional */ }
    } catch { statusEnvio = "erro" }

    // ── UPDATE msg_status com fallback REST ──
    let updateOk = false
    let debugInfo = ""

    const { data: upd1, error: err1 } = await sb
      .from("live_compras").update({ msg_status: statusEnvio }).eq("id", compra.id).select("id, msg_status")
    if (err1) {
      debugInfo += `T1 err: ${err1.message}. `
    } else if (upd1?.length && upd1[0].msg_status === statusEnvio) {
      updateOk = true
    }

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
        if (restResp.ok) {
          updateOk = true
          debugInfo += `T2-REST ok. `
        } else {
          debugInfo += `T2-REST falhou: ${restResp.status}. `
        }
      } catch (e: unknown) {
        debugInfo += `T2-REST exc: ${e instanceof Error ? e.message : String(e)}. `
      }
    }

    if (updateOk) {
      try {
        await sb.from("live_compras").update({
          msg_enviada_em: new Date().toISOString(),
          msg_texto: mensagem,
        }).eq("id", compra.id)
      } catch { /* campos opcionais */ }
    }

    if (!updateOk) statusEnvio = "erro"

    resultados.push({ id: compra.id, cliente: compra.nome_cliente, numero, status: statusEnvio, detalhe: debugInfo || undefined })
  }

  const todosOk = resultados.every(r => r.status === "enviada")
  if (todosOk) await sb.from("lives").update({ status: "disparada" }).eq("id", live_id)

  return NextResponse.json({
    ok: true,
    enviadas: resultados.filter(r => r.status === "enviada").length,
    erros:    resultados.filter(r => r.status === "erro").length,
    resultados,
  })
}
