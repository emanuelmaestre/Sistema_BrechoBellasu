import { NextRequest, NextResponse } from "next/server"
import { type SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
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

// POST body { compra_id, chave_pix } — processa UMA compra: monta a
// mensagem com a chave PIX e envia via Z-API. Retorna o resultado individual.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const live_id = parseInt(id)
  const sb = createServerClient()

  const body = await req.json().catch(() => ({})) as { compra_id?: number; chave_pix?: string }
  const compraId = body.compra_id
  const chavePix = (body.chave_pix ?? "").trim()
  if (!compraId) {
    return NextResponse.json({ erro: "compra_id é obrigatório." }, { status: 400 })
  }

  // ── Dados da live ──
  const { data: liveRow } = await sb.from("lives").select("data_live").eq("id", live_id).single()
  const dataLive = ((liveRow as Record<string, unknown>)?.data_live ?? null) as string | null

  // ── A compra ──
  const { data: compra } = await sb
    .from("live_compras").select("*").eq("id", compraId).eq("live_id", live_id).single()
  if (!compra) return NextResponse.json({ erro: "Compra não encontrada." }, { status: 404 })

  if (!PENDENTE(compra as Record<string, unknown>)) {
    return NextResponse.json({ id: compraId, cliente: compra.nome_cliente, status: "enviada", detalhe: "já processada" })
  }

  // ── Dados do cliente ──
  let nomeCadastro: string | null = null
  let celularCadastro: string | null = null
  let saldoCreditoAtual: number = 0

  if (compra.cliente_id) {
    const { data: cli } = await sb.from("clientes")
      .select("nome, celular, saldo_credito")
      .eq("id", compra.cliente_id).single()
    nomeCadastro      = cli?.nome ?? null
    celularCadastro   = cli?.celular ?? null
    saldoCreditoAtual = parseFloat(String(cli?.saldo_credito ?? 0)) || 0
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
  const pagoCreditoTotal = valorFinal === 0 && creditoAplicado > 0

  // ── Monta a mensagem ──
  const compraData: CompraData = {
    data_compra:            dataLive ?? compra.data_compra,
    data_live:              dataLive ?? compra.data_compra ?? null,
    numero_sacola:          compra.numero_sacola,
    quantidade_itens:       compra.quantidade_itens,
    valor_total:            compra.valor_total,
    desconto:               desconto,
    nome_cliente:           nomeCadastro ?? compra.nome_cliente,
    chave_pix:              pagoCreditoTotal ? null : (chavePix || null),
    credito_aplicado:       creditoAplicado || null,
    pago_com_credito:       pagoCreditoTotal,
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

  // ── Marca enviada ── (quando o crédito quitou tudo, a compra já está paga)
  const updateEnviada: Record<string, unknown> = { msg_status: "enviada" }
  if (pagoCreditoTotal) updateEnviada.pagamento_status = "PAGO"
  await sb.from("live_compras").update(updateEnviada).eq("id", compraId)
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
