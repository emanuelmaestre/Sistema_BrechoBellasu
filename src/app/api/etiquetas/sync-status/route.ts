import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { rastrearEtiqueta } from "@/lib/melhorenvio"
import { sfRastrear, sfConfigurado } from "@/lib/superfrete"
import { enviarTexto } from "@/lib/zapi"

export const dynamic = "force-dynamic"

// POST /api/etiquetas/sync-status — Sincroniza status das etiquetas e notifica mudanças
export const POST = withAuth(async () => {
  const sb = createServerClient()

  const { data: etiquetas } = await sb
    .from("etiquetas")
    .select("id, rastreio, cliente_id, ultimo_status, notificado_transito, notificado_entregue, carrier")
    .not("rastreio", "is", null)
    .not("ultimo_status", "in", '("entregue","cancelada")')

  if (!etiquetas?.length) return NextResponse.json({ ok: true, atualizadas: 0 })

  let atualizadas = 0
  let notificadas = 0

  for (const et of etiquetas) {
    try {
      const carrier = (et.carrier ?? "melhorenvio") as "melhorenvio" | "superfrete"

      let eventos: Array<{ description: string; date: string; location: string }> = []
      if (carrier === "superfrete" && sfConfigurado()) {
        const tracking = await sfRastrear(et.rastreio)
        eventos = tracking.events ?? []
      } else if (carrier === "melhorenvio") {
        const tracking = await rastrearEtiqueta(et.rastreio)
        if (!tracking) continue
        eventos = tracking.events ?? []
      } else {
        continue
      }

      const ultimoEvento = eventos[0]?.description?.toLowerCase() ?? ""
      let novoStatus = et.ultimo_status
      if (ultimoEvento.includes("entreg")) {
        novoStatus = "entregue"
      } else if (ultimoEvento.includes("trânsito") || ultimoEvento.includes("transito") || ultimoEvento.includes("encaminhado")) {
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
          const linkRastreio = carrier === "superfrete"
            ? `https://superfrete.com/rastreio/${et.rastreio}`
            : `https://melhorrastreio.com.br/rastreio/${et.rastreio}`

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
    } catch { /* continua para próxima etiqueta */ }
  }

  return NextResponse.json({ ok: true, atualizadas, notificadas })
})
