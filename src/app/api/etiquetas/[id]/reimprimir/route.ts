import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { createServerClient } from "@/lib/supabase"
import { imprimirEtiqueta } from "@/lib/melhorenvio"
import { sfImprimirEtiqueta, sfConfigurado } from "@/lib/superfrete"

export const dynamic = "force-dynamic"

// POST /api/etiquetas/[id]/reimprimir  — [id] = id da etiqueta no banco
// Reabre o PDF da MESMA etiqueta já gerada (não gera nova ordem, não gasta saldo).
// Incrementa o contador de reimpressões e registra a data.
export const POST = withAuth(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const etiquetaId = parseInt(id)
    if (!etiquetaId) return NextResponse.json({ erro: "Etiqueta inválida." }, { status: 400 })

    const sb = createServerClient()
    const { data: et, error } = await sb
      .from("etiquetas")
      .select("id, me_order_id, quantidade_reimpressoes, carrier")
      .eq("id", etiquetaId)
      .maybeSingle()

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    if (!et?.me_order_id) return NextResponse.json({ erro: "Etiqueta não encontrada." }, { status: 404 })

    const carrier = (et.carrier ?? "melhorenvio") as "melhorenvio" | "superfrete"

    let printUrl: string | undefined
    if (carrier === "superfrete") {
      if (!sfConfigurado()) return NextResponse.json({ erro: "Super Frete não configurado." }, { status: 503 })
      const printed = await sfImprimirEtiqueta([et.me_order_id])
      printUrl = printed?.url
    } else {
      const printed = await imprimirEtiqueta([et.me_order_id])
      printUrl = printed?.url
    }

    if (!printUrl) return NextResponse.json({ erro: "Etiqueta ainda não disponível para impressão." }, { status: 404 })

    // Incrementa contador de reimpressões (best-effort)
    try {
      await sb.from("etiquetas").update({
        quantidade_reimpressoes: (et.quantidade_reimpressoes ?? 0) + 1,
        data_ultima_reimpressao: new Date().toISOString(),
      }).eq("id", etiquetaId)
    } catch (e) {
      console.error("[reimprimir] falha ao atualizar contador:", (e as Error).message)
    }

    return NextResponse.json({ url: printUrl, order_id: et.me_order_id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível reimprimir a etiqueta."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
