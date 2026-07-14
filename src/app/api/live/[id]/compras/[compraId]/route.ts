import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

interface PatchBody {
  pagamento_status?: string
  nome_cliente?: string
  whatsapp?: string | null
  numero_sacola?: string | null
  quantidade_itens?: number
  valor_total?: number
  desconto?: number
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; compraId: string }> }
) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 })
  const { id, compraId } = await params
  const body = await req.json().catch(() => ({})) as PatchBody
  const sb = createServerClient()

  // Marcar pagamento (botão "PAGO" na tabela da live)
  if (body.pagamento_status) {
    const { error } = await sb.from("live_compras")
      .update({ pagamento_status: body.pagamento_status })
      .eq("id", parseInt(compraId))
      .eq("live_id", parseInt(id))
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Edição completa dos dados da compra (modal "Editar Compra").
  // Ao editar, a compra volta para pendente de disparo (msg_status) — o
  // disparo precisa ser refeito para reenviar os dados corrigidos.
  const update: Record<string, unknown> = { status_compra: "pendente", msg_status: "pendente" }
  if (body.nome_cliente !== undefined) {
    if (!body.nome_cliente.trim()) return NextResponse.json({ erro: "Nome da cliente é obrigatório." }, { status: 400 })
    update.nome_cliente = body.nome_cliente.trim()
  }
  if (body.whatsapp !== undefined)         update.whatsapp = body.whatsapp
  if (body.numero_sacola !== undefined)    update.numero_sacola = body.numero_sacola
  if (body.quantidade_itens !== undefined) {
    if (!Number.isFinite(body.quantidade_itens) || body.quantidade_itens < 1) {
      return NextResponse.json({ erro: "Quantidade de itens inválida." }, { status: 400 })
    }
    update.quantidade_itens = body.quantidade_itens
  }
  if (body.valor_total !== undefined) {
    if (!Number.isFinite(body.valor_total) || body.valor_total < 0) {
      return NextResponse.json({ erro: "Valor total inválido." }, { status: 400 })
    }
    update.valor_total = body.valor_total
  }
  if (body.desconto !== undefined) {
    if (!Number.isFinite(body.desconto) || body.desconto < 0) {
      return NextResponse.json({ erro: "Desconto inválido." }, { status: 400 })
    }
    update.desconto = body.desconto
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ erro: "Nenhum dado para atualizar." }, { status: 400 })
  }

  const { error } = await sb.from("live_compras")
    .update(update)
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

  // Estorna o estoque dos produtos vinculados antes de excluir a compra.
  // A FK live_compra_produtos.compra_id tem ON DELETE CASCADE — os vínculos
  // seriam apagados pelo banco silenciosamente, sem devolver o estoque.
  const { data: itensVinculados } = await sb.from("live_compra_produtos")
    .select("produto_id, quantidade, estoque_baixado")
    .eq("compra_id", parseInt(compraId))
  for (const item of itensVinculados ?? []) {
    if (!item.produto_id || !item.estoque_baixado) continue
    const { data: prod } = await sb.from("produtos").select("estoque_atual").eq("id", item.produto_id).single()
    if (prod) {
      await sb.from("produtos").update({
        estoque_atual: (prod.estoque_atual ?? 0) + (item.quantidade ?? 1),
      }).eq("id", item.produto_id)
    }
  }

  const { error } = await sb.from("live_compras").delete().eq("id", parseInt(compraId))
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}