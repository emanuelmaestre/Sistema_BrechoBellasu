import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { CriarVendaUseCase } from "@/application/vendas/criar-venda.use-case"
import { VendaRepositorySupabase } from "@/infrastructure/repositories/venda.repository"
import { EstoqueReaderSupabase } from "@/infrastructure/repositories/estoque.reader"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl
  const de          = searchParams.get("de")
  const ate         = searchParams.get("ate")
  const cliente_id  = searchParams.get("cliente_id")
  const vendedor_id = searchParams.get("vendedor_id")
  const page        = parseInt(searchParams.get("page") ?? "1")
  const limit       = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)
  const from        = (page - 1) * limit
  const to          = from + limit - 1

  const sb = createServerClient()
  let q = sb.from("v_vendas").select("*", { count: "exact" })

  // A view usa created_at, não data_venda — filtra pela data de criação (UTC→BR)
  if (de)          q = q.gte("created_at", `${de}T00:00:00`)
  if (ate)         q = q.lte("created_at", `${ate}T23:59:59`)
  if (cliente_id)  q = q.eq("cliente_id", cliente_id)
  if (vendedor_id) q = q.eq("vendedor_id", vendedor_id)

  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, to)
  if (error) {
    console.error("[GET /api/vendas]", error)
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  // Buscar qtd_itens por venda (um único join)
  const ids = (data ?? []).map((v: Record<string, unknown>) => v.id as number)
  let qtdMap: Record<number, number> = {}
  if (ids.length > 0) {
    const { data: itensCount } = await sb
      .from("venda_itens")
      .select("venda_id, qtd")
      .in("venda_id", ids)
    if (itensCount) {
      for (const row of itensCount as { venda_id: number; qtd: number }[]) {
        qtdMap[row.venda_id] = (qtdMap[row.venda_id] ?? 0) + row.qtd
      }
    }
  }

  // Mapear para o formato esperado pelo frontend
  const mapped = (data ?? []).map((v: Record<string, unknown>) => {
    const dt = new Date(v.created_at as string)
    const datePart = dt.toISOString().split("T")[0]                          // "2026-05-23"
    const timePart = dt.toTimeString().slice(0, 8)                           // "13:02:07"
    return {
      id:             v.id,
      numero:         v.id,          // usar id como número sequencial
      data_venda:     datePart,
      hora_venda:     timePart,
      cliente_id:     v.cliente_id,
      cliente_nome:   v.cliente_nome,
      vendedor_nome:  v.vendedor_nome,
      qtd_itens:           qtdMap[v.id as number] ?? 0,
      total:               v.total,
      forma_pagamento:     v.forma_pagamento,
      status:              v.status,
      desconto:            v.desconto,
      observacoes:         v.obs,
      notificacao_status:  v.notificacao_status ?? null,
    }
  })

  return NextResponse.json({ data: mapped, total: count })
})

// Controller fino: apenas traduz HTTP ⇄ use case. A regra de negócio
// (cálculo de total, validação de estoque, atomicidade) vive no domínio,
// no use case e na função Postgres — não aqui.
type ItemInput = {
  produto_id?: number | null
  nome_produto?: string
  nome?: string
  quantidade?: number
  qtd?: number
  preco_unitario?: number
  preco_unit?: number
}

export const POST = withAuth(async (req: NextRequest, _ctx: unknown, auth: { id: number; perfil: string }) => {
  try {
    const body = await req.json()
    const itens = (body.itens as ItemInput[] | undefined) ?? []

    const sb = createServerClient()
    const useCase = new CriarVendaUseCase(
      new VendaRepositorySupabase(sb),
      new EstoqueReaderSupabase(sb),
    )

    const resultado = await useCase.execute({
      clienteId: body.cliente_id ?? null,
      vendedorId: auth.id,
      formaPagamento: body.forma_pagamento,
      desconto: Number(body.desconto_geral) || 0,
      observacoes: body.observacoes ?? null,
      itens: itens.map((it) => ({
        produtoId: it.produto_id ?? null,
        nome: it.nome_produto ?? it.nome ?? "",
        quantidade: it.quantidade ?? it.qtd ?? 1,
        precoUnitario: it.preco_unitario ?? it.preco_unit ?? 0,
      })),
    })

    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }

    const vendaId = resultado.value.id
    const sb2 = createServerClient()

    // Marca como PENDENTE imediatamente — o frontend gerará e enviará o PDF
    await sb2.from("vendas")
      .update({ notificacao_status: "pendente" })
      .eq("id", vendaId)

    // Debita crédito se solicitado
    const creditoUsar = Number(body.credito_usar) || 0
    if (creditoUsar > 0 && body.cliente_id) {
      const { error: errCredito } = await sb2.rpc("fn_credito_saida", {
        p_cliente_id: body.cliente_id,
        p_valor:      creditoUsar,
        p_origem:     "venda",
        p_obs:        `Venda #${vendaId}`,
        p_op_id:      vendaId,
        p_op_tipo:    "venda",
        p_user_id:    auth.id,
      })
      if (errCredito) {
        console.error("[POST /api/vendas] erro ao debitar crédito:", errCredito)
        // Cancelar a venda se o débito de crédito falhou — mantém consistência
        await sb2.rpc("fn_cancelar_venda", { p_id: vendaId })
        return NextResponse.json(
          { erro: `Erro ao debitar crédito: ${errCredito.message}` },
          { status: 422 }
        )
      }
    }

    return NextResponse.json(
      { id: vendaId, total: resultado.value.total },
      { status: 201 },
    )
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[POST /api/vendas]", err)
    return NextResponse.json(erro, { status })
  }
})
