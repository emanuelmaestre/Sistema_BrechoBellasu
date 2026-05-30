import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string; compraId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { compraId } = await params
  const sb = createServerClient()

  const { data: compra } = await sb.from("live_compras").select("quantidade_itens, valor_total").eq("id", parseInt(compraId)).single()
  const { data: prods }  = await sb.from("live_compra_produtos").select("*").eq("compra_id", parseInt(compraId))

  if (!compra) return NextResponse.json({ erro: "Compra não encontrada." }, { status: 404 })
  if (!prods?.length) return NextResponse.json({ erro: "Nenhum produto vinculado." }, { status: 422 })

  const totalVinculado = prods.reduce((s, p) => s + (p.quantidade ?? 1), 0)
  const totalBaixado   = prods.filter(p => p.estoque_baixado).reduce((s, p) => s + (p.quantidade ?? 1), 0)
  const qtdEsperada    = compra.quantidade_itens ?? 0

  if (totalVinculado < qtdEsperada) {
    return NextResponse.json({
      erro: `Quantidade divergente. Esperado: ${qtdEsperada} itens. Vinculado: ${totalVinculado}.`
    }, { status: 422 })
  }

  if (totalBaixado < totalVinculado) {
    return NextResponse.json({ erro: "Nem todos os produtos tiveram baixa no estoque." }, { status: 422 })
  }

  await sb.from("live_compras").update({ status_compra: "finalizada" }).eq("id", parseInt(compraId))
  return NextResponse.json({ ok: true })
}
