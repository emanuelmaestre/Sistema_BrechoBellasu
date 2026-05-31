import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { enviarTexto } from "@/lib/zapi"

export const dynamic = "force-dynamic"

// GET /api/financeiro/alertas — Retorna contas a vencer nos próximos 3 dias
export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const sb = createServerClient()
  const hoje = new Date()
  const em3dias = new Date(hoje)
  em3dias.setDate(hoje.getDate() + 3)

  const hojeStr = hoje.toISOString().split("T")[0]
  const em3diasStr = em3dias.toISOString().split("T")[0]

  // Contas a pagar
  const { data: pagar } = await sb
    .from("contas_pagar")
    .select("id, descricao, valor, vencimento, status")
    .eq("status", "pendente")
    .lte("vencimento", em3diasStr)
    .order("vencimento")

  // Contas a receber
  const { data: receber } = await sb
    .from("contas_receber")
    .select("id, descricao, valor, vencimento, status")
    .eq("status", "pendente")
    .lte("vencimento", em3diasStr)
    .order("vencimento")

  const alertas = {
    pagar: (pagar ?? []).map(c => ({
      ...c,
      vencido: c.vencimento < hojeStr,
    })),
    receber: (receber ?? []).map(c => ({
      ...c,
      vencido: c.vencimento < hojeStr,
    })),
  }

  return NextResponse.json(alertas)
}

// POST /api/financeiro/alertas — Dispara alertas via WhatsApp manualmente
export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

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

  if (!pagar?.length) return NextResponse.json({ ok: true, mensagem: "Nenhuma conta a vencer." })

  // Busca números de alerta
  const { data: configs } = await sb
    .from("config_alertas")
    .select("chave, valor")
    .in("chave", ["alerta_numero_1", "alerta_numero_2"])

  const numeros = (configs ?? [])
    .map(c => c.valor?.trim())
    .filter(Boolean)

  if (numeros.length === 0) {
    return NextResponse.json({ erro: "Nenhum número de alerta configurado." }, { status: 400 })
  }

  // Monta mensagem
  const lista = pagar.map(c => {
    const dt = new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR")
    const val = Number(c.valor).toFixed(2).replace(".", ",")
    return `  • ${c.descricao} — vence em ${dt} — R$ ${val}`
  }).join("\n")

  const msg = `⚠️ *Alerta Brechó Bellasu*\n\nVocê tem *${pagar.length} conta(s)* vencendo nos próximos 3 dias:\n\n${lista}`

  // Dispara para todos os números
  const resultados = await Promise.allSettled(
    numeros.map(n => enviarTexto(n, msg, "alerta_financeiro"))
  )

  const enviados = resultados.filter(r => r.status === "fulfilled" && (r.value as { ok: boolean }).ok).length

  return NextResponse.json({ ok: true, enviados, total: numeros.length })
}
