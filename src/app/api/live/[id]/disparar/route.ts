import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { gerarLinkAsaas } from "@/lib/asaas"
import { enviarTexto } from "@/lib/zapi"
import {
  buildCompleteMessage,
  type CompraData,
} from "@/lib/live-message-builder"

export const dynamic = "force-dynamic"
// Cada chamada processa apenas UMA compra (1 envio), então o ritmo de 8–40s
// fica no navegador. Isso evita o timeout do Vercel que cortava disparos longos.
export const maxDuration = 60

const PENDENTE = (c: Record<string, unknown>) =>
  !c.msg_status || c.msg_status === "pendente" || c.msg_status === "erro"

// GET — lista as compras pendentes desta live (o front orquestra o disparo).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const live_id = parseInt(id)
  const sb = createServerClient()

  const { data: todas } = await sb
    .from("live_compras")
    .select("id, nome_cliente, msg_status")
    .eq("live_id", live_id)
    .order("nome_cliente")

  const pendentes = (todas ?? [])
    .filter(PENDENTE)
    .map((c: Record<string, unknown>) => ({ id: c.id as number, nome: c.nome_cliente as string }))

  return NextResponse.json({ ok: true, total: pendentes.length, pendentes })
}

// POST body { compra_id } — processa UMA compra: gera link Asaas, monta a
// mensagem e envia via Z-API. Retorna o resultado individual.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const live_id = parseInt(id)
  const sb = createServerClient()

  const body = await req.json().catch(() => ({})) as { compra_id?: number }
  const compraId = body.compra_id
  if (!compraId) {
    return NextResponse.json({ erro: "compra_id é obrigatório." }, { status: 400 })
  }

  // ── Dados da live (data e tipo) ──
  const { data: liveRow } = await sb.from("lives").select("data_live, tipo").eq("id", live_id).single()
  const tipoLive = ((liveRow as Record<string, unknown>)?.tipo ?? "novidades") as "novidades" | "promocional"
  const dataLive = ((liveRow as Record<string, unknown>)?.data_live ?? null) as string | null

  // ── A compra ──
  const { data: compra } = await sb
    .from("live_compras").select("*").eq("id", compraId).eq("live_id", live_id).single()
  if (!compra) return NextResponse.json({ erro: "Compra não encontrada." }, { status: 404 })

  if (!PENDENTE(compra as Record<string, unknown>)) {
    return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, status: "enviada", detalhe: "já processada" })
  }

  // ── Dados atuais do cliente (cadastro é a fonte de verdade do número) ──
  let cpf: string | null = null
  let nomeCadastro: string | null = null
  let celularCadastro: string | null = null
  let dadosExtras: Record<string, string | null> = {}
  if (compra.cliente_id) {
    const { data: cli } = await sb.from("clientes")
      .select("cpf_cnpj, nome, celular, email, logradouro, numero, complemento, bairro, cidade, estado, cep")
      .eq("id", compra.cliente_id).single()
    cpf             = cli?.cpf_cnpj ?? null
    nomeCadastro    = cli?.nome ?? null
    celularCadastro = cli?.celular ?? null
    dadosExtras     = {
      email:       cli?.email ?? null,
      celular:     cli?.celular ?? null,
      logradouro:  cli?.logradouro ?? null,
      numero:      cli?.numero ?? null,
      complemento: cli?.complemento ?? null,
      bairro:      cli?.bairro ?? null,
      cidade:      cli?.cidade ?? null,
      estado:      cli?.estado ?? null,
      cep:         cli?.cep ?? null,
    }
  }

  const numero = ((celularCadastro || compra.whatsapp || "") as string).replace(/\D/g, "")
  if (!numero) {
    await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compraId)
    return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, numero: "", status: "erro", detalhe: "Sem WhatsApp" })
  }

  // ── Garante link Asaas ──
  let linkPagamento: string = compra.link_pagamento || ""
  if (!linkPagamento) {
    const valorFinal = Math.max(
      0,
      parseFloat(String(compra.valor_total ?? 0))
        - parseFloat(String(compra.desconto ?? 0))
        - parseFloat(String(compra.credito_aplicado ?? 0)),
    )
    if (valorFinal > 0) {
      const sacola = [compra.cor_sacola, compra.numero_sacola ? `#${compra.numero_sacola}` : ""].filter(Boolean).join(" ")
      const resultado = await gerarLinkAsaas({
        nome: compra.nome_cliente,
        cpf,
        valor: valorFinal,
        descricao: `Compra Live${sacola ? ` — Sacola ${sacola}` : ""}`,
        tipoLive,
        ...dadosExtras,
      })
      if (resultado) {
        linkPagamento = resultado.url
        const upd: Record<string, unknown> = { link_pagamento: resultado.url, pagamento_status: "EM_ABERTO" }
        try { await sb.from("live_compras").update({ ...upd, asaas_payment_id: resultado.paymentId }).eq("id", compraId) }
        catch { await sb.from("live_compras").update(upd).eq("id", compraId) }
      }
    }
  }

  // ── Monta a mensagem ──
  const compraData: CompraData = {
    data_compra:      dataLive ?? compra.data_compra,
    data_live:        dataLive ?? compra.data_compra ?? null,
    numero_sacola:    compra.numero_sacola,
    cor_sacola:       compra.cor_sacola,
    quantidade_itens: compra.quantidade_itens,
    valor_total:      compra.valor_total,
    nome_cliente:     nomeCadastro ?? compra.nome_cliente,
    link_pagamento:   linkPagamento || null,
    credito_aplicado: parseFloat(String(compra.credito_aplicado ?? 0)) || null,
  }

  const msgResult = buildCompleteMessage(compraData)
  if (!msgResult.valida) {
    await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compraId)
    return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, numero, status: "erro", detalhe: msgResult.erro })
  }

  // ── Envia (zapi resolve o número real e valida WhatsApp internamente) ──
  let resultadoZap
  try {
    resultadoZap = await enviarTexto(numero, msgResult.mensagem, "aviso_live")
  } catch (e) {
    resultadoZap = { ok: false, erro: e instanceof Error ? e.message : String(e) }
  }

  if (!resultadoZap.ok) {
    await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compraId)
    return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, numero, status: "erro", detalhe: resultadoZap.erro ?? "Falha Z-API" })
  }

  // ── Marca enviada + guarda messageId (para o webhook de entrega casar) ──
  await sb.from("live_compras").update({ msg_status: "enviada" }).eq("id", compraId)
  try {
    await sb.from("live_compras").update({
      msg_enviada_em: new Date().toISOString(),
      msg_texto: msgResult.mensagem,
      msg_zapi_id: resultadoZap.messageId ?? null,
    }).eq("id", compraId)
  } catch { /* campos opcionais — não bloqueiam o envio */ }

  // ── Se não restam pendentes, marca a live como disparada ──
  const { data: restantes } = await sb
    .from("live_compras").select("msg_status").eq("live_id", live_id)
  const aindaPendentes = (restantes ?? []).filter(PENDENTE).length
  if (aindaPendentes === 0) {
    await sb.from("lives").update({ status: "disparada" }).eq("id", live_id)
  }

  return NextResponse.json({
    id: compraId,
    cliente: compra.nome_cliente,
    numero,
    status: "enviada",
    messageId: resultadoZap.messageId,
    restantes: aindaPendentes,
  })
}
