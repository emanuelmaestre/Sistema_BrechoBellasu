import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { orquestrarEnvioConsentimentoCliente } from "@/lib/consentimento-agent"

export const dynamic = "force-dynamic"
export const maxDuration = 300

// POST /api/admin/reenviar-consentimento-erros
// Protegido por CRON_SECRET — reenvia consentimento para todos com status = 'erro'
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  }

  const sb = createServerClient()

  const { data: clientes, error } = await sb
    .from("clientes")
    .select("id, nome, celular, notificacao_status")
    .eq("notificacao_status", "erro")
    .not("celular", "is", null)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  if (!clientes?.length) return NextResponse.json({ ok: true, mensagem: "Nenhum cliente com erro encontrado.", total: 0 })

  const resultados: Array<{ id: number; nome: string; celular: string; ok: boolean; detalhe?: string }> = []

  for (const c of clientes) {
    try {
      const res = await orquestrarEnvioConsentimentoCliente({
        clienteId: c.id,
        nome: c.nome ?? "Cliente",
        celular: c.celular,
      })
      resultados.push({ id: c.id, nome: c.nome, celular: c.celular, ok: res.ok, detalhe: res.erro ?? (res.skipped ? res.motivo : undefined) })
    } catch (e) {
      resultados.push({ id: c.id, nome: c.nome, celular: c.celular, ok: false, detalhe: e instanceof Error ? e.message : String(e) })
    }
  }

  const enviadas = resultados.filter(r => r.ok).length
  const erros    = resultados.filter(r => !r.ok).length

  return NextResponse.json({ ok: true, total: clientes.length, enviadas, erros, resultados })
}
