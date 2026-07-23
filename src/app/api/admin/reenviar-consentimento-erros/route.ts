import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { enviarConsentimentoCliente } from "@/lib/consentimento-agent"
import { requireCronAuth } from "@/lib/server-guards"

export const dynamic = "force-dynamic"

// POST /api/admin/reenviar-consentimento-erros
// Protegido por CRON_SECRET — reenvia consentimento para todos com status = 'erro'
export async function POST(req: NextRequest) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  const sb = createServerClient()

  const { data: clientes, error } = await sb
    .from("clientes")
    .select("id, nome, celular, notificacao_status")
    .eq("notificacao_status", "erro")
    .not("celular", "is", null)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  if (!clientes?.length) return NextResponse.json({ ok: true, mensagem: "Nenhum cliente com erro encontrado.", total: 0 })

  const promises = clientes.map(async (c) => {
    try {
      const res = await enviarConsentimentoCliente({
        clienteId: c.id,
        nome: c.nome ?? "Cliente",
        celular: c.celular,
      })
      return { id: c.id, nome: c.nome, celular: c.celular, ok: res.ok, detalhe: res.erro ?? ((res as { skipped?: boolean; motivo?: string }).skipped ? (res as { skipped?: boolean; motivo?: string }).motivo : undefined) }
    } catch (e) {
      return { id: c.id, nome: c.nome, celular: c.celular, ok: false, detalhe: e instanceof Error ? e.message : String(e) }
    }
  })
  const resultados = await Promise.allSettled(promises).then(rs =>
    rs.map(r => r.status === "fulfilled" ? r.value : { id: 0, nome: "", celular: "", ok: false, detalhe: "Erro inesperado" })
  )

  const enviadas = resultados.filter(r => r.ok).length
  const erros = resultados.filter(r => !r.ok).length

  return NextResponse.json({ ok: true, total: clientes.length, enviadas, erros, resultados })
}
