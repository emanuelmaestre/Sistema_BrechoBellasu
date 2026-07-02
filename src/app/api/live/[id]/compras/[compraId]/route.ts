import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; compraId: string }> }
) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 })
  const { id, compraId } = await params
  const body = await req.json().catch(() => ({})) as { pagamento_status?: string }
  if (!body.pagamento_status) return NextResponse.json({ erro: "pagamento_status obrigatorio." }, { status: 400 })
  const sb = createServerClient()
  const { error } = await sb.from("live_compras")
    .update({ pagamento_status: body.pagamento_status })
    .eq("id", parseInt(compraId))
    .eq("live_id", parseInt(id))
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; compraId: string }> }
) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 })
  const { id, compraId } = await params
  const sb = createServerClient()
  const { data: compra } = await sb.from("live_compras")
    .select("id, cliente_id, credito_aplicado")
    .eq("id", parseInt(compraId)).eq("live_id", parseInt(id)).single()
  if (!compra) return NextResponse.json({ erro: "Compra nao encontrada." }, { status: 404 })

  // Estorna o crédito da cliente antes de excluir a compra — senão o valor
  // fica deduzido do saldo dela para sempre, sem nenhuma compra associada.
  const creditoAplicado = parseFloat(String(compra.credito_aplicado ?? 0))
  if (creditoAplicado > 0 && compra.cliente_id) {
    try {
      await sb.rpc("fn_credito_entrada", {
        p_cliente_id: compra.cliente_id,
        p_valor:      creditoAplicado,
        p_origem:     "ajuste",
        p_obs:        `Estorno por exclusão da compra da live (compra #${compraId})`,
        p_op_id:      parseInt(compraId),
        p_op_tipo:    "venda",
        p_user_id:    null,
      })
    } catch (errCredito) {
      console.error("[DELETE compra] erro ao estornar crédito:", errCredito)
      return NextResponse.json({ erro: "Não foi possível estornar o crédito da cliente. Compra não excluída." }, { status: 500 })
    }
  }

  const { error } = await sb.from("live_compras").delete().eq("id", parseInt(compraId))
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}