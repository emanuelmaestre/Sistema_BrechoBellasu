import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

// DELETE /api/clientes/[id]/creditos/[movId]
// Remove a movimentação e estorna o saldo do cliente.
export const DELETE = withAuth(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; movId: string }> },
) => {
  const { id, movId } = await params
  const clienteId = parseInt(id)
  const movimentacaoId = parseInt(movId)

  const sb = createServerClient()

  // Busca a movimentação para saber tipo e valor
  const { data: mov, error: errBusca } = await sb
    .from("creditos_clientes")
    .select("id, tipo, valor, cliente_id")
    .eq("id", movimentacaoId)
    .eq("cliente_id", clienteId)
    .single()

  if (errBusca || !mov) {
    return NextResponse.json({ erro: "Movimentação não encontrada." }, { status: 404 })
  }

  // Estorna o saldo: se era entrada, subtrai; se era saída, devolve
  const ajuste = mov.tipo === "entrada" ? -Number(mov.valor) : Number(mov.valor)

  const { error: errSaldo } = await sb.rpc("fn_ajustar_saldo_credito", {
    p_cliente_id: clienteId,
    p_ajuste: ajuste,
  }).single()

  // Se a função RPC não existir, faz update direto
  if (errSaldo) {
    const { data: cli } = await sb
      .from("clientes")
      .select("saldo_credito")
      .eq("id", clienteId)
      .single()

    const novoSaldo = Math.max(0, Number(cli?.saldo_credito ?? 0) + ajuste)
    await sb.from("clientes").update({ saldo_credito: novoSaldo }).eq("id", clienteId)
  }

  // Remove a movimentação
  const { error: errDel } = await sb
    .from("creditos_clientes")
    .delete()
    .eq("id", movimentacaoId)

  if (errDel) return NextResponse.json({ erro: errDel.message }, { status: 500 })

  return NextResponse.json({ ok: true })
})
