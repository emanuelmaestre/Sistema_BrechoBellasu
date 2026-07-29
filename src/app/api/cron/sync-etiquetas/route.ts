import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { rastrearEtiqueta } from "@/lib/melhorenvio"
import { sfRastrear, sfConfigurado } from "@/lib/superfrete"
import { enviarTexto } from "@/lib/zapi"
import { requireCronAuth } from "@/lib/server-guards"
import { readIntEnv } from "@/lib/server-env"

export const dynamic = "force-dynamic"

// GET /api/cron/sync-etiquetas — Vercel Cron: roda 2x por dia
// Verifica rastreio das etiquetas ativas e atualiza status no Supabase
export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  const startedAt = Date.now()
  const maxEtiquetas = readIntEnv("SYNC_ETIQUETAS_CRON_MAX_ITENS", 40, 1, 200)
  const maxRuntimeMs = readIntEnv("SYNC_ETIQUETAS_CRON_MAX_RUNTIME_MS", 50_000, 10_000, 240_000)
  const safetyWindowMs = 15_000
  const sb = createServerClient()

  const { data: etiquetas } = await sb
    .from("etiquetas")
    // Não exigimos me_tracking: no Super Frete o rastreio só existe depois de
    // "released", e a consulta de situação é feita pelo ID do pedido.
    .select("id, me_order_id, me_tracking, cliente_id, ultimo_status, notificado_transito, notificado_entregue, carrier")
    .not("ultimo_status", "in", '("entregue","cancelada")')
    .order("id", { ascending: true })
    .limit(maxEtiquetas)

  if (!etiquetas?.length) return NextResponse.json({ ok: true, atualizadas: 0 })

  let atualizadas = 0
  let notificadas = 0
  let processadas = 0
  const erros: Array<{ id: number; erro: string }> = []

  for (const et of etiquetas) {
    if (Date.now() - startedAt > maxRuntimeMs - safetyWindowMs) break
    processadas++

    try {
      const carrier = (et.carrier ?? "melhorenvio") as "melhorenvio" | "superfrete"

      let eventos: Array<{ description: string; date: string; location: string }> = []
      let statusSF = ""
      if (carrier === "superfrete" && sfConfigurado()) {
        if (!et.me_order_id) continue
        const info = await sfRastrear(et.me_order_id)
        eventos  = info.events ?? []
        statusSF = info.status
      } else if (carrier === "melhorenvio") {
        if (!et.me_tracking) continue
        const tracking = await rastrearEtiqueta(et.me_tracking)
        if (!tracking) continue
        eventos = tracking.events ?? []
      } else {
        continue
      }

      const ultimoEvento = eventos[0]?.description?.toLowerCase() ?? ""
      let novoStatus = et.ultimo_status

      if (statusSF === "canceled") {
        novoStatus = "cancelada"
      } else if (ultimoEvento.includes("entreg")) {
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
      // A tela usa a coluna "status" para o selo e para decidir se ainda cabe
      // cancelar; sem isto a etiqueta cancelada seguia como "aguardando".
      if (novoStatus === "cancelada") updates.status = "canceled"
      if (statusSF && statusSF !== "canceled") updates.status = statusSF

      if (et.cliente_id) {
        const { data: cliente } = await sb
          .from("clientes")
          .select("nome, celular")
          .eq("id", et.cliente_id)
          .single()

        if (cliente?.celular) {
          const nome = cliente.nome?.split(" ")[0] ?? "Cliente"
          const linkRastreio = carrier === "superfrete"
            ? `https://superfrete.com/rastreio/${et.me_tracking}`
            : `https://melhorrastreio.com.br/rastreio/${et.me_tracking}`

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
    } catch (err) {
      erros.push({ id: et.id, erro: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({
    ok: true,
    limite: maxEtiquetas,
    carregadas: etiquetas.length,
    processadas,
    pendentes_lote: Math.max(0, etiquetas.length - processadas),
    atualizadas,
    notificadas,
    erros: erros.length,
    detalhes_erros: erros.slice(0, 20),
  })
}
