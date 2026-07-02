import { NextRequest, NextResponse } from "next/server"
import { type SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { gerarLinkAsaas } from "@/lib/asaas"
import { enviarTexto } from "@/lib/zapi"
import {
  buildCompleteMessage,
  type CompraData,
  type ProdutoMensagem,
} from "@/lib/live-message-builder"

export const dynamic = "force-dynamic"
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

  const body = await req.json().catch(() => ({})) as { compra_id?: number; apenas_link?: boolean }
  const compraId = body.compra_id
  const apenasLink = body.apenas_link === true
  if (!compraId) {
    return NextResponse.json({ erro: "compra_id é obrigatório." }, { status: 400 })
  }

  // ── Dados da live ──
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

  // ── Dados do cliente ──
  let cpf: string | null = null
  let nomeCadastro: string | null = null
  let celularCadastro: string | null = null
  let saldoCreditoAtual: number = 0
  let dadosExtras: Record<string, string | null> = {}

  if (compra.cliente_id) {
    const { data: cli } = await sb.from("clientes")
      .select("cpf_cnpj, nome, celular, email, saldo_credito, logradouro, numero, complemento, bairro, cidade, estado, cep")
      .eq("id", compra.cliente_id).single()
    cpf             = cli?.cpf_cnpj ?? null
    nomeCadastro    = cli?.nome ?? null
    celularCadastro = cli?.celular ?? null
    saldoCreditoAtual = parseFloat(String(cli?.saldo_credito ?? 0)) || 0
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

  // ── Produtos vinculados à compra ──
  const { data: produtosRaw } = await sb
    .from("live_compra_produtos")
    .select("nome_produto, preco_live, preco_original, produtos(marca, cor, tamanho)")
    .eq("compra_id", compraId)
    .order("id")

  const produtos: ProdutoMensagem[] = (produtosRaw ?? []).map((p: Record<string, unknown>) => {
    const prod = p.produtos as { marca?: string | null; cor?: string | null; tamanho?: string | null } | null
    return {
      nome:    String(p.nome_produto ?? ""),
      marca:   prod?.marca ?? null,
      cor:     prod?.cor ?? null,
      tamanho: prod?.tamanho ?? null,
      preco:   parseFloat(String(p.preco_live ?? p.preco_original ?? 0)),
    }
  })

  const numero = ((celularCadastro || compra.whatsapp || "") as string).replace(/\D/g, "")
  if (!numero) {
    await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compraId)
    return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, numero: "", status: "erro", detalhe: "Sem WhatsApp" })
  }

  // ── Calcula valor final (desconto + crédito registrado na compra) ──
  const valorTotal      = parseFloat(String(compra.valor_total ?? 0))
  const desconto        = parseFloat(String(compra.desconto ?? 0))
  const creditoAplicado = parseFloat(String(compra.credito_aplicado ?? 0))
  const valorFinal      = Math.max(0, valorTotal - desconto - creditoAplicado)

  // ── Caso especial: crédito quita tudo ──
  if (valorFinal === 0 && creditoAplicado > 0) {
    if (apenasLink) {
      return NextResponse.json({ id: compraId, link_pagamento: null, pago_com_credito: true })
    }

    // Monta mensagem de quitação por crédito
    const compraData: CompraData = {
      data_compra:            dataLive ?? compra.data_compra,
      data_live:              dataLive ?? compra.data_compra ?? null,
      numero_sacola:          compra.numero_sacola,
      cor_sacola:             compra.cor_sacola,
      quantidade_itens:       compra.quantidade_itens,
      valor_total:            compra.valor_total,
      desconto:               desconto,
      nome_cliente:           nomeCadastro ?? compra.nome_cliente,
      link_pagamento:         null,
      credito_aplicado:       creditoAplicado,
      pago_com_credito:       true,
      saldo_credito_anterior: saldoCreditoAtual + creditoAplicado,
      produtos,
    }

    const msgResult = buildCompleteMessage(compraData)
    if (!msgResult.valida) {
      await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compraId)
      return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, numero, status: "erro", detalhe: msgResult.erro })
    }

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

    // Registra como pago com crédito
    await sb.from("live_compras").update({ msg_status: "enviada", pagamento_status: "PAGO" }).eq("id", compraId)
    try {
      await sb.from("live_compras").update({
        msg_enviada_em: new Date().toISOString(),
        msg_texto: msgResult.mensagem,
        msg_zapi_id: resultadoZap.messageId ?? null,
      }).eq("id", compraId)
    } catch { /* campos opcionais */ }

    verificarLiveFinalizada(sb, live_id)
    return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, numero, status: "enviada", messageId: resultadoZap.messageId, pago_com_credito: true })
  }

  // ── Integração Asaas não configurada ──
  if (!compra.link_pagamento && valorFinal > 0 && !process.env.ASAAS_TOKEN) {
    const detalhe = "Pagamento por link não está configurado (falta a chave da integração Asaas). Peça para configurar em Configurações → Integrações, ou marque esta compra como paga manualmente."
    if (apenasLink) {
      return NextResponse.json({ id: compraId, link_pagamento: null, erro: detalhe })
    }
    await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compraId)
    return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, numero, status: "erro", detalhe })
  }

  // ── Valor abaixo do mínimo do Asaas (R$ 5,00) ──
  const ASAAS_VALOR_MINIMO = 5
  if (!compra.link_pagamento && valorFinal > 0 && valorFinal < ASAAS_VALOR_MINIMO) {
    const detalhe = `Valor (${valorFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) abaixo do mínimo do Asaas (R$ 5,00). Ajuste o valor ou marque como pago manualmente.`
    if (apenasLink) {
      return NextResponse.json({ id: compraId, link_pagamento: null, erro: detalhe })
    }
    await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compraId)
    return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, numero, status: "erro", detalhe })
  }

  // ── CPF obrigatório para o Asaas gerar a cobrança ──
  if (!compra.link_pagamento && valorFinal > 0 && !cpf) {
    const detalhe = `Cliente sem CPF cadastrado. O Asaas exige CPF para gerar o link. Cadastre o CPF de "${compra.nome_cliente}" ou marque como pago manualmente.`
    if (apenasLink) {
      return NextResponse.json({ id: compraId, link_pagamento: null, erro: detalhe })
    }
    await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compraId)
    return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, numero, status: "erro", detalhe })
  }

  // ── Garante link Asaas ──
  let linkPagamento: string = compra.link_pagamento || ""
  if (!linkPagamento && valorFinal > 0) {
    const sacola = [compra.cor_sacola, compra.numero_sacola ? `#${compra.numero_sacola}` : ""].filter(Boolean).join(" ")
    const resultado = await gerarLinkAsaas({
      nome: compra.nome_cliente,
      cpf,
      valor: valorFinal,
      descricao: `Compra Live${sacola ? ` — Sacola ${sacola}` : ""}`,
      tipoLive,
      dataLive,
      ...dadosExtras,
    })
    if (resultado) {
      linkPagamento = resultado.url
      const upd: Record<string, unknown> = { link_pagamento: resultado.url, pagamento_status: "EM_ABERTO" }
      try { await sb.from("live_compras").update({ ...upd, asaas_payment_id: resultado.paymentId }).eq("id", compraId) }
      catch { await sb.from("live_compras").update(upd).eq("id", compraId) }
    } else {
      // Asaas retornou null — falha ao gerar cobrança
      console.error("[disparar] Asaas falhou ao gerar link para compra", compraId, {
        cliente: compra.nome_cliente, valorFinal, cpf: cpf ? "***" : "ausente",
      })
      const detalheAsaas = "Não foi possível gerar o link de pagamento (Asaas). Verifique se o token está correto em Configurações → Integrações e tente novamente, ou marque a compra como paga manualmente."
      if (apenasLink) {
        return NextResponse.json({ id: compraId, link_pagamento: null, erro: detalheAsaas })
      }
      await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compraId)
      return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, numero, status: "erro", detalhe: detalheAsaas })
    }
  }

  // ── Modo apenas_link: retorna o link sem enviar a mensagem ──
  if (apenasLink) {
    return NextResponse.json({ id: compraId, link_pagamento: linkPagamento || null })
  }

  // ── Valida: não dispara sem link (exceto crédito total, já tratado acima) ──
  if (!linkPagamento && valorFinal > 0) {
    await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compraId)
    return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, numero, status: "erro", detalhe: "Link de pagamento não disponível. Tente novamente ou marque como pago manualmente." })
  }

  // ── Monta a mensagem ──
  const compraData: CompraData = {
    data_compra:            dataLive ?? compra.data_compra,
    data_live:              dataLive ?? compra.data_compra ?? null,
    numero_sacola:          compra.numero_sacola,
    cor_sacola:             compra.cor_sacola,
    quantidade_itens:       compra.quantidade_itens,
    valor_total:            compra.valor_total,
    desconto:               desconto,
    nome_cliente:           nomeCadastro ?? compra.nome_cliente,
    link_pagamento:         linkPagamento || null,
    credito_aplicado:       creditoAplicado || null,
    saldo_credito_anterior: creditoAplicado > 0 ? saldoCreditoAtual + creditoAplicado : null,
    produtos,
  }

  const msgResult = buildCompleteMessage(compraData)
  if (!msgResult.valida) {
    await sb.from("live_compras").update({ msg_status: "erro" }).eq("id", compraId)
    return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, numero, status: "erro", detalhe: msgResult.erro })
  }

  // ── Envia ──
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

  // ── Marca enviada ──
  await sb.from("live_compras").update({ msg_status: "enviada" }).eq("id", compraId)
  try {
    await sb.from("live_compras").update({
      msg_enviada_em: new Date().toISOString(),
      msg_texto: msgResult.mensagem,
      msg_zapi_id: resultadoZap.messageId ?? null,
    }).eq("id", compraId)
  } catch { /* campos opcionais */ }

  await verificarLiveFinalizada(sb, live_id)

  return NextResponse.json({
    id: compraId,
    cliente: compra.nome_cliente,
    numero,
    status: "enviada",
    messageId: resultadoZap.messageId,
  })
}

async function verificarLiveFinalizada(sb: SupabaseClient, live_id: number) {
  const { data: restantes } = await sb
    .from("live_compras").select("msg_status").eq("live_id", live_id)
  const aindaPendentes = (restantes ?? []).filter(PENDENTE).length
  if (aindaPendentes === 0) {
    await sb.from("lives").update({ status: "disparada" }).eq("id", live_id)
  }
}
