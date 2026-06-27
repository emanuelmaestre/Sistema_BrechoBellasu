import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { orquestrarEnvioConsentimentoCliente } from "@/lib/consentimento-agent"
import { enviarTexto } from "@/lib/zapi"

export const dynamic = "force-dynamic"

type ConfigFollowup = {
  ativo: boolean
  horas: number
  max: number
}

// GET /api/cron/alertas — Vercel Cron: roda todo dia às 8h (UTC-3 = 11:00 UTC)
// Vercel Cron envia header Authorization com CRON_SECRET
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: "Você precisa estar logado para realizar esta ação." }, { status: 401 })
  }

  const [financeiro, consentimentoFollowup] = await Promise.all([
    processarAlertasFinanceiros(),
    processarFollowupConsentimento(),
  ])

  return NextResponse.json({ ok: true, financeiro, consentimento_followup: consentimentoFollowup })
}

async function processarAlertasFinanceiros() {
  const sb = createServerClient()
  const hoje = new Date()
  const em3dias = new Date(hoje)
  em3dias.setDate(hoje.getDate() + 3)
  const em3diasStr = em3dias.toISOString().split("T")[0]

  const { data: pagar } = await sb
    .from("contas_pagar")
    .select("descricao, valor, vencimento")
    .eq("status", "pendente")
    .lte("vencimento", em3diasStr)
    .order("vencimento")

  if (!pagar?.length) return { contas: 0, numeros: 0, mensagem: "Nenhuma conta a vencer." }

  const { data: configs } = await sb
    .from("config_alertas")
    .select("chave, valor")
    .in("chave", ["alerta_numero_1", "alerta_numero_2"])

  const numeros = (configs ?? []).map(c => c.valor?.trim()).filter(Boolean)
  if (numeros.length === 0) return { contas: pagar.length, numeros: 0, mensagem: "Sem números de alerta configurados." }

  const lista = pagar.map(c => {
    const dt = new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR")
    const val = Number(c.valor).toFixed(2).replace(".", ",")
    return `  • ${c.descricao} — vence ${dt} — R$ ${val}`
  }).join("\n")

  const msg = `⚠️ *Alerta Brechó Bellasu*\n\nVocê tem *${pagar.length} conta(s)* vencendo nos próximos 3 dias:\n\n${lista}\n\n📅 ${hoje.toLocaleDateString("pt-BR")}`

  await Promise.allSettled(
    numeros.map(n => enviarTexto(n, msg, "alerta_financeiro"))
  )

  return { contas: pagar.length, numeros: numeros.length }
}

async function carregarConfigFollowup(): Promise<ConfigFollowup> {
  const sb = createServerClient()
  const { data } = await sb
    .from("config_alertas")
    .select("chave, valor")
    .in("chave", ["consentimento_followup_ativo", "consentimento_followup_horas", "consentimento_followup_max"])

  const cfg: Record<string, string> = {}
  for (const row of data ?? []) cfg[row.chave] = row.valor

  return {
    ativo: cfg.consentimento_followup_ativo !== "false",
    horas: Math.max(1, Number(cfg.consentimento_followup_horas ?? 24) || 24),
    max: Math.max(0, Number(cfg.consentimento_followup_max ?? 1) || 1),
  }
}

async function processarFollowupConsentimento() {
  const cfg = await carregarConfigFollowup()
  if (!cfg.ativo || cfg.max <= 0) return { enviados: 0, erros: 0, total: 0, pulado: true }

  const sb = createServerClient()
  const limite = new Date(Date.now() - cfg.horas * 60 * 60 * 1000).toISOString()

  const { data: clientes, error } = await sb
    .from("clientes")
    .select("id, nome, celular, consentimento_followup_count, consentimento_respondido_em")
    .eq("notificacao_status", "enviado")
    .eq("aceita_novidades", "aguardando")
    .eq("aceita_lives", "aguardando")
    .lte("consentimento_enviado_em", limite)
    .lt("consentimento_followup_count", cfg.max)
    // Não envia follow-up se o cliente já respondeu (mesmo que o webhook tenha falhado em atualizar o status)
    .is("consentimento_respondido_em", null)
    .not("celular", "is", null)
    .limit(30)

  if (error || !clientes?.length) return { enviados: 0, erros: 0, total: 0 }

  let enviados = 0
  let erros = 0

  for (const cliente of clientes) {
    const resultado = await orquestrarEnvioConsentimentoCliente({
      clienteId: cliente.id,
      nome: cliente.nome ?? "Cliente",
      celular: cliente.celular,
      tipo: "followup",
    })

    if (resultado.ok && !resultado.skipped) {
      enviados++
      await sb.from("clientes")
        .update({ consentimento_followup_count: Number(cliente.consentimento_followup_count ?? 0) + 1 })
        .eq("id", cliente.id)
    } else {
      erros++
    }
  }

  return { enviados, erros, total: clientes.length }
}
