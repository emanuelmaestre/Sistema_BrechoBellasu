import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { getClientIp, rateLimit } from "@/lib/rateLimit"
import { enviarTexto } from "@/lib/zapi"
import { buildBroadcastMessage } from "@/lib/broadcast-message-builder"
import { grauPenalidade, type GrauPenalidade } from "@/domain/live/penalidade"
import liveUiData from "@/data/ui/live.json"

export const dynamic = "force-dynamic"

const MOTIVO_LABEL = Object.fromEntries(
  liveUiData.penaltyReasons.map((r) => [r.value, r.label]),
) as Record<string, string>

// Corpo padrão por grau — a small talk (saudação variada) entra na frente
// via buildBroadcastMessage, então aqui só o recado em si.
function montarCorpoPadrao(grau: GrauPenalidade, motivo: string | null): string {
  const motivoTexto = motivo ? MOTIVO_LABEL[motivo] ?? motivo : null

  if (grau === "bloqueada") {
    return (
      `Passando pra avisar que seu cadastro está *bloqueado* pra novas contemplações em lives da Brechó Bellasu` +
      (motivoTexto ? `, por: ${motivoTexto}.` : ".") +
      `\n\nSe quiser entender melhor ou resolver a situação, é só responder por aqui. 💛`
    )
  }
  if (grau === "restrita") {
    return (
      `Seu cadastro está com *restrição* nas lives da Brechó Bellasu` +
      (motivoTexto ? ` (${motivoTexto}).` : ".") +
      `\n\nMais uma ocorrência e o cadastro fica bloqueado pra contemplações. Qualquer dúvida, é só chamar aqui. 💛`
    )
  }
  return (
    `Passando pra te avisar que seu cadastro recebeu uma *advertência* nas lives da Brechó Bellasu` +
    (motivoTexto ? ` (${motivoTexto}).` : ".") +
    `\n\nÉ só um alerta — quer entender melhor? Responde aqui que a gente conversa. 💛`
  )
}

// POST /api/live/penalidades/avisar — envia o aviso de UMA cliente por vez.
// Orquestrado pelo disparo.store no front, que controla o intervalo seguro
// entre envios (mesmo motor usado nos avisos de live).
export const POST = withAuth(async (req: NextRequest, _ctx: unknown, auth: { id: number }) => {
  const ip = getClientIp(req)
  const rl = rateLimit(`penalidades-avisar:${auth.id}:${ip}`, 60, 60 * 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { erro: `Muitos avisos. Tente novamente em ${rl.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    )
  }

  const body = await req.json().catch(() => ({})) as {
    cliente_id?: number
    celular?: string
    mensagem?: string
  }
  const clienteId = Number(body.cliente_id)
  if (!Number.isSafeInteger(clienteId) || clienteId <= 0) {
    return NextResponse.json({ erro: "cliente_id inválido." }, { status: 400 })
  }

  const sb = createServerClient()
  const { data: cliente, error } = await sb
    .from("clientes")
    .select("id, nome, celular, total_penalidades_ativas")
    .eq("id", clienteId)
    .single()

  if (error || !cliente) {
    return NextResponse.json({ status: "erro", detalhe: "Cliente não encontrada." }, { status: 404 })
  }

  // Número digitado na tela CORRIGE o cadastro (é comum essa lista ter
  // celular vazio ou desatualizado) — não é só um valor pontual do envio.
  const celularDigitado = body.celular?.replace(/\D/g, "") ?? ""
  const celular = celularDigitado || cliente.celular
  if (!celular || celular.length < 10) {
    return NextResponse.json({ status: "erro", detalhe: "Sem número de WhatsApp válido para esta cliente." }, { status: 400 })
  }
  if (celularDigitado && celularDigitado !== (cliente.celular ?? "").replace(/\D/g, "")) {
    await sb.from("clientes").update({ celular: celularDigitado }).eq("id", clienteId)
  }

  const { data: ultimaPenalidade } = await sb
    .from("penalidades_clientes")
    .select("motivo")
    .eq("cliente_id", clienteId)
    .eq("status", "ativa")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const grau = grauPenalidade(cliente.total_penalidades_ativas ?? 0)
  const corpo = body.mensagem?.trim() || montarCorpoPadrao(grau, ultimaPenalidade?.motivo ?? null)
  const mensagem = buildBroadcastMessage(cliente.nome, corpo)

  const resultado = await enviarTexto(celular, mensagem, "aviso_penalidade")

  if (resultado.ok) {
    await sb.from("clientes").update({ penalidade_aviso_em: new Date().toISOString() }).eq("id", clienteId)
  }

  return NextResponse.json({
    status: resultado.ok ? "enviado" : "erro",
    detalhe: resultado.erro,
    cliente: cliente.nome,
  })
})
