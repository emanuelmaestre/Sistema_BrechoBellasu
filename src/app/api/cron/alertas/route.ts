import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { enviarTexto } from "@/lib/zapi"

export const dynamic = "force-dynamic"

// GET /api/cron/alertas — Vercel Cron: roda todo dia às 8h (UTC-3 = 11:00 UTC)
// Vercel Cron envia header Authorization com CRON_SECRET
export async function GET(req: NextRequest) {
  // Valida que é chamada pelo Vercel Cron ou manualmente com token
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: "Você precisa estar logado para realizar esta ação." }, { status: 401 })
  }

  const sb = createServerClient()
  const hoje = new Date()
  const em3dias = new Date(hoje)
  em3dias.setDate(hoje.getDate() + 3)
  const em3diasStr = em3dias.toISOString().split("T")[0]

  // Contas a pagar pendentes vencendo nos próximos 3 dias
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

  const numeros = (configs ?? []).map(c => c.valor?.trim()).filter(Boolean)
  if (numeros.length === 0) return NextResponse.json({ ok: true, mensagem: "Sem números de alerta configurados." })

  const lista = pagar.map(c => {
    const dt = new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR")
    const val = Number(c.valor).toFixed(2).replace(".", ",")
    return `  • ${c.descricao} — vence ${dt} — R$ ${val}`
  }).join("\n")

  const msg = `⚠️ *Alerta Brechó Bellasu*\n\nVocê tem *${pagar.length} conta(s)* vencendo nos próximos 3 dias:\n\n${lista}\n\n📅 ${hoje.toLocaleDateString("pt-BR")}`

  await Promise.allSettled(
    numeros.map(n => enviarTexto(n, msg, "alerta_financeiro"))
  )

  return NextResponse.json({ ok: true, contas: pagar.length, numeros: numeros.length })
}
