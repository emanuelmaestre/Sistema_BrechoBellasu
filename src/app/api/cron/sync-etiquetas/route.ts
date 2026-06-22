import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { rastrearEtiqueta } from "@/lib/melhorenvio"
import { enviarTexto } from "@/lib/zapi"

export const dynamic = "force-dynamic"

// GET /api/cron/sync-etiquetas — Vercel Cron: roda 2x por dia
// Verifica rastreio das etiquetas ativas e atualiza status no Supabase
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  }

  const sb = createServerClient()

  const { data: etiquetas } = await sb
    .from("etiquetas")
    .select("id, rastreio, cliente_id, ultimo_status, notificado_transito, notificado_entregue")
    .not("rastreio", "is", null)
    .not("ultimo_status", "in", '("entregue","cancelada")')

  if (!etiquetas?.length) return NextResponse.json({ ok: true, atualizadas: 0 })

  let atualizadas = 0
  let notificadas = 0

  for (const et of etiquetas) {
    try {
      const tracking = await rastrearEtiqueta(et.rastreio)
      if (!tracking) continue

      const eventos = tracking.events ?? []
      const ultimoEvento = eventos[0]?.description?.toLowerCase() ?? ""
      let novoStatus = et.ultimo_status

      if (ultimoEvento.includes("entreg")) {
        novoStatus = "entregue"
      } else if (
        ultimoEvento.includes("trânsito") ||
        ultimoEvento.includes("transito") ||
        ultimoEvento.includes("encaminhado")
      ) {
        novoStatus = "em_transito"
      } else if (ultimoEvento.includes("postado") || ultimoEvento.includes("coletado")) {
        novoStatus = "postado"
      }

      if (novoStatus === et.ultimo_status) continue

      const updates: Record<string, unknown> = { ultimo_status: novoStatus }

      if (et.cliente_id) {
        const { data: cliente } = await sb
          .from("clientes")
          .select("nome, celular")
          .eq("id", et.cliente_id)
          .single()

        if (cliente?.celular) {
          const nome = cliente.nome?.split(" ")[0] ?? "Cliente"
          const linkRastreio = `https://melhorrastreio.com.br/rastreio/${et.rastreio}`

          if (novoStatus === "em_transito" && !et.notificado_transito) {
            await enviarTexto(
              cliente.celular,
              `Oi ${nome}! 🚚\n\nSeu pedido está *a caminho*! Rastreie aqui:\n${linkRastreio}`,
              "status_envio",
            )
            updates.notificado_transito = true
            notificadas++
          }

          if (novoStatus === "entregue" && !et.notificado_entregue) {
            await enviarTexto(
              cliente.celular,
              `Oi ${nome}! ✅\n\nSeu pedido foi *entregue*! Qualquer dúvida, estamos aqui. 💛`,
              "status_envio",
            )
            updates.notificado_entregue = true
            notificadas++
          }
        }
      }

      await sb.from("etiquetas").update(updates).eq("id", et.id)
      atualizadas++
    } catch { /* continua para próxima */ }
  }

  return NextResponse.json({ ok: true, atualizadas, notificadas })
}
