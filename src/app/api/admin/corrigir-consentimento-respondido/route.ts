import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Variantes de número para cruzar log com clientes
function gerarVariantesNumero(telefone: string): string[] {
  const variants = new Set<string>()
  const limpo = telefone.replace(/\D/g, "")
  variants.add(limpo)
  const semDDI = limpo.startsWith("55") ? limpo.substring(2) : limpo
  const comDDI = limpo.startsWith("55") ? limpo : `55${limpo}`
  variants.add(semDDI)
  variants.add(comDDI)
  if (semDDI.length === 11) {
    const s = semDDI.substring(0, 2) + semDDI.substring(3)
    variants.add(s)
    variants.add(`55${s}`)
  } else if (semDDI.length === 10) {
    const c = semDDI.substring(0, 2) + "9" + semDDI.substring(2)
    variants.add(c)
    variants.add(`55${c}`)
  }
  return Array.from(variants)
}

const SIM_WORDS = new Set(["sim", "s", "yes", "y", "quero", "aceito", "claro", "pode", "autorizo", "ok", "tá", "ta"])
const NAO_WORDS = new Set(["nao", "não", "n", "no", "nao quero", "não quero", "recuso", "pare", "não autorizo", "nao autorizo", "cancela", "cancelar"])

/**
 * GET — diagnóstico: lista clientes com status "enviado" que têm resposta no whatsapp_log
 * POST — correção: aplica as correções encontradas no diagnóstico
 */

// GET /api/admin/corrigir-consentimento-respondido
export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const sb = createServerClient()

  // 1. Clientes ainda com status "enviado" (deveriam ter sido atualizados)
  const { data: clientesEnviados } = await sb
    .from("clientes")
    .select("id, nome, celular, notificacao_status, aceita_novidades, consentimento_enviado_em")
    .eq("notificacao_status", "enviado")
    .eq("aceita_novidades", "aguardando")
    .not("celular", "is", null)
    .order("consentimento_enviado_em", { ascending: false })
    .limit(500)

  if (!clientesEnviados?.length) {
    return NextResponse.json({ ok: true, total: 0, casos: [], mensagem: "Nenhum cliente pendente encontrado." })
  }

  // 2. Busca logs de mensagens recebidas (tipo "recebida") para cruzar
  const { data: logs } = await sb
    .from("whatsapp_log")
    .select("telefone, mensagem, created_at")
    .eq("tipo", "recebida")
    .order("created_at", { ascending: false })
    .limit(5000)

  const logsPorTel = new Map<string, { mensagem: string; created_at: string }[]>()
  for (const log of logs ?? []) {
    const t = (log.telefone ?? "").replace(/\D/g, "")
    if (!logsPorTel.has(t)) logsPorTel.set(t, [])
    logsPorTel.get(t)!.push({ mensagem: log.mensagem, created_at: log.created_at })
  }

  // 3. Cruza clientes × logs
  const casos: Array<{
    id: number
    nome: string
    celular: string
    enviado_em: string | null
    resposta: string
    respondeu_em: string
    acao: "autorizar" | "recusar"
  }> = []

  for (const cliente of clientesEnviados) {
    const variantes = gerarVariantesNumero(cliente.celular ?? "")
    let encontrado: { mensagem: string; created_at: string } | null = null

    for (const v of variantes) {
      const entradas = logsPorTel.get(v) ?? []
      // Filtra apenas respostas APÓS o envio do consentimento
      const enviadoEm = cliente.consentimento_enviado_em ? new Date(cliente.consentimento_enviado_em).getTime() : 0
      const respostas = entradas.filter(e => {
        const msg = (e.mensagem ?? "").toLowerCase().trim()
        return (SIM_WORDS.has(msg) || NAO_WORDS.has(msg)) && new Date(e.created_at).getTime() > enviadoEm
      })
      if (respostas.length > 0) {
        // Pega a resposta mais antiga após o envio
        encontrado = respostas.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
        break
      }
    }

    if (encontrado) {
      const msg = (encontrado.mensagem ?? "").toLowerCase().trim()
      casos.push({
        id: cliente.id,
        nome: cliente.nome ?? "",
        celular: cliente.celular ?? "",
        enviado_em: cliente.consentimento_enviado_em,
        resposta: encontrado.mensagem,
        respondeu_em: encontrado.created_at,
        acao: SIM_WORDS.has(msg) ? "autorizar" : "recusar",
      })
    }
  }

  return NextResponse.json({
    ok: true,
    total_pendentes: clientesEnviados.length,
    total_com_resposta_no_log: casos.length,
    casos,
  })
}

// POST /api/admin/corrigir-consentimento-respondido
// Aplica as correções: atualiza status dos clientes que já responderam
export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { confirmar?: boolean }
  const sb = createServerClient()

  // Repete o diagnóstico para garantir dados frescos
  const { data: clientesEnviados } = await sb
    .from("clientes")
    .select("id, nome, celular, notificacao_status, aceita_novidades, consentimento_enviado_em")
    .eq("notificacao_status", "enviado")
    .eq("aceita_novidades", "aguardando")
    .not("celular", "is", null)
    .limit(500)

  const { data: logs } = await sb
    .from("whatsapp_log")
    .select("telefone, mensagem, created_at")
    .eq("tipo", "recebida")
    .order("created_at", { ascending: false })
    .limit(5000)

  const logsPorTel = new Map<string, { mensagem: string; created_at: string }[]>()
  for (const log of logs ?? []) {
    const t = (log.telefone ?? "").replace(/\D/g, "")
    if (!logsPorTel.has(t)) logsPorTel.set(t, [])
    logsPorTel.get(t)!.push({ mensagem: log.mensagem, created_at: log.created_at })
  }

  const corrigidos: Array<{ id: number; nome: string; acao: string; ok: boolean; erro?: string }> = []

  for (const cliente of clientesEnviados ?? []) {
    const variantes = gerarVariantesNumero(cliente.celular ?? "")
    let encontrado: { mensagem: string; created_at: string } | null = null

    for (const v of variantes) {
      const entradas = logsPorTel.get(v) ?? []
      const enviadoEm = cliente.consentimento_enviado_em ? new Date(cliente.consentimento_enviado_em).getTime() : 0
      const respostas = entradas.filter(e => {
        const msg = (e.mensagem ?? "").toLowerCase().trim()
        return (SIM_WORDS.has(msg) || NAO_WORDS.has(msg)) && new Date(e.created_at).getTime() > enviadoEm
      })
      if (respostas.length > 0) {
        encontrado = respostas.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
        break
      }
    }

    if (!encontrado) continue

    const msg = (encontrado.mensagem ?? "").toLowerCase().trim()
    const ehSim = SIM_WORDS.has(msg)
    const novoStatus = ehSim ? "autorizado" : "recusado"
    const novoConsent = ehSim ? "confirmado" : "recusado"

    if (!body.confirmar) {
      // Modo simulação — apenas lista o que faria
      corrigidos.push({ id: cliente.id, nome: cliente.nome ?? "", acao: `${novoStatus} (simulação)`, ok: true })
      continue
    }

    const { error } = await sb.from("clientes")
      .update({
        notificacao_status: novoStatus,
        aceita_novidades: novoConsent,
        aceita_lives: novoConsent,
        consentimento_respondido_em: encontrado.created_at,
      })
      .eq("id", cliente.id)

    corrigidos.push({
      id: cliente.id,
      nome: cliente.nome ?? "",
      acao: novoStatus,
      ok: !error,
      erro: error?.message,
    })
  }

  return NextResponse.json({
    ok: true,
    modo: body.confirmar ? "aplicado" : "simulacao",
    total_corrigidos: corrigidos.length,
    autorizados: corrigidos.filter(c => c.acao.startsWith("autorizado")).length,
    recusados: corrigidos.filter(c => c.acao.startsWith("recusado")).length,
    corrigidos,
  })
}
