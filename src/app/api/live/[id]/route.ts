import { NextRequest, NextResponse } from "next/server"
import { calcularStatusCompra } from "@/domain/live/status-compra"
import { verifyAuth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const LIVE_STATUSES = new Set([
  "aberta",
  "encerrada",
  "disparada",
  "agendada",
  "ao_vivo",
])

function parseLiveId(value: string): number | null {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyAuth(req)
  if (!auth) {
    return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 })
  }

  const { id: idParam } = await params
  const id = parseLiveId(idParam)
  if (!id) {
    return NextResponse.json({ erro: "Live invalida." }, { status: 400 })
  }

  const sb = createServerClient()
  const { data: live, error: liveError } = await sb
    .from("lives")
    .select("*")
    .eq("id", id)
    .single()
  if (liveError || !live) {
    return NextResponse.json({ erro: "Live nao encontrada." }, { status: 404 })
  }

  const { data: compras, error: comprasError } = await sb
    .from("live_compras")
    .select("*")
    .eq("live_id", id)
    .order("created_at")
  if (comprasError) {
    console.error("[live-detalhe] Falha ao carregar compras:", comprasError.message)
    return NextResponse.json(
      { erro: "Falha ao carregar compras da live." },
      { status: 500 }
    )
  }

  const ids = (compras ?? []).map(c => c.id)
  const clienteIds = [...new Set(
    (compras ?? [])
      .map(c => c.cliente_id)
      .filter((value): value is number => typeof value === "number")
  )]
  const penalidadesPorCliente: Record<number, number> = {}

  if (clienteIds.length > 0) {
    const { data: clientes, error: penalidadesError } = await sb
      .from("clientes")
      .select("id, total_penalidades_ativas")
      .in("id", clienteIds)
    if (penalidadesError) {
      console.error(
        "[live-detalhe] Falha ao carregar penalidades:",
        penalidadesError.message
      )
      return NextResponse.json(
        { erro: "Falha ao carregar penalidades das clientes." },
        { status: 500 }
      )
    }

    for (const cliente of clientes ?? []) {
      penalidadesPorCliente[cliente.id] =
        cliente.total_penalidades_ativas ?? 0
    }
  }

  type ProdutoRow = {
    compra_id: number
    quantidade: number
    estoque_baixado?: boolean
  }
  type ItemRow = { live_compra_id: number; [key: string]: unknown }

  let produtosNovos: ProdutoRow[] = []
  let itensLegados: ItemRow[] = []
  if (ids.length > 0) {
    const [produtosResult, itensResult] = await Promise.all([
      sb
        .from("live_compra_produtos")
        .select("compra_id, quantidade, estoque_baixado")
        .in("compra_id", ids),
      sb
        .from("live_compra_itens")
        .select("*")
        .in("live_compra_id", ids),
    ])

    if (produtosResult.error || itensResult.error) {
      console.error(
        "[live-detalhe] Falha ao carregar itens:",
        produtosResult.error?.message ?? itensResult.error?.message
      )
      return NextResponse.json(
        { erro: "Falha ao carregar itens das compras." },
        { status: 500 }
      )
    }

    produtosNovos = (produtosResult.data ?? []) as ProdutoRow[]
    itensLegados = (itensResult.data ?? []) as ItemRow[]
  }

  const produtosPorCompra: Record<number, ProdutoRow[]> = {}
  for (const produto of produtosNovos) {
    if (!produtosPorCompra[produto.compra_id]) {
      produtosPorCompra[produto.compra_id] = []
    }
    produtosPorCompra[produto.compra_id].push(produto)
  }

  const comprasComItens = (compras ?? []).map(compra => {
    const produtos = produtosPorCompra[compra.id] ?? []
    const vinculos = produtos.map(produto => ({
      quantidade: Number(produto.quantidade ?? 1),
      estoqueBaixado: produto.estoque_baixado === true,
    }))
    const totalVinculados = vinculos.reduce(
      (total, vinculo) => total + vinculo.quantidade,
      0
    )
    const totalBaixados = vinculos
      .filter(vinculo => vinculo.estoqueBaixado)
      .reduce((total, vinculo) => total + vinculo.quantidade, 0)
    const statusCalculado = calcularStatusCompra(
      Number(compra.quantidade_itens ?? 0),
      vinculos
    )
    const statusFinal =
      compra.status_compra === "retirada" && statusCalculado === "finalizada"
        ? "retirada"
        : statusCalculado

    return {
      ...compra,
      total_produtos_vinculados: totalVinculados,
      total_estoque_baixado: totalBaixados,
      status_compra: statusFinal,
      cliente_penalidades:
        compra.cliente_id != null
          ? (penalidadesPorCliente[compra.cliente_id] ?? 0)
          : 0,
      itens: itensLegados.filter(item => item.live_compra_id === compra.id),
    }
  })

  return NextResponse.json({ ...live, compras: comprasComItens })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyAuth(req)
  if (!auth) {
    return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 })
  }

  const { id: idParam } = await params
  const id = parseLiveId(idParam)
  if (!id) {
    return NextResponse.json({ erro: "Live invalida." }, { status: 400 })
  }

  const body = await req.json().catch(() => null) as { status?: unknown } | null
  const status = typeof body?.status === "string" ? body.status : ""
  if (!LIVE_STATUSES.has(status)) {
    return NextResponse.json({ erro: "Status invalido." }, { status: 400 })
  }

  const sb = createServerClient()
  const { data, error } = await sb
    .from("lives")
    .update({ status })
    .eq("id", id)
    .select()
    .single()
  if (error) {
    return NextResponse.json(
      { erro: "Erro ao atualizar status." },
      { status: 500 }
    )
  }
  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyAuth(req)
  if (!auth) {
    return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 })
  }

  const { id: idParam } = await params
  const id = parseLiveId(idParam)
  if (!id) {
    return NextResponse.json({ erro: "Live invalida." }, { status: 400 })
  }

  const sb = createServerClient()
  const { error } = await sb.from("lives").delete().eq("id", id)
  if (error) {
    return NextResponse.json(
      { erro: "Erro ao excluir live." },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}
