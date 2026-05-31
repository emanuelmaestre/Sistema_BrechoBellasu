import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { RegistrarCompraLiveUseCase } from "@/application/live/registrar-compra.use-case"
import { LiveCompraRepositorySupabase } from "@/infrastructure/repositories/live-compra.repository"
import { AsaasGateway } from "@/infrastructure/services/asaas.gateway"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

type ItemBody = {
  produto_id?: number | null
  nome_produto?: string
  quantidade?: number
  preco_unitario?: number
  desconto_item?: number
  eh_live?: boolean
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()

    const sb = createServerClient()
    const useCase = new RegistrarCompraLiveUseCase(
      new LiveCompraRepositorySupabase(sb),
      new AsaasGateway(),
    )

    const itens = ((body.itens as ItemBody[] | undefined) ?? []).map((it) => ({
      produtoId: it.produto_id ?? null,
      nomeProduto: it.nome_produto ?? "",
      quantidade: it.quantidade ?? 1,
      precoUnitario: it.preco_unitario ?? 0,
      descontoItem: it.desconto_item ?? 0,
      ehLive: it.eh_live !== false,
    }))

    const resultado = await useCase.execute({
      liveId: parseInt(id),
      clienteId: body.cliente_id ?? null,
      nomeCliente: body.nome_cliente ?? null,
      whatsapp: body.whatsapp ?? null,
      dataCompra: body.data_compra ?? null,
      corSacola: body.cor_sacola ?? null,
      numeroSacola: body.numero_sacola ?? null,
      quantidadeItens: body.quantidade_itens ?? 1,
      valorTotal: body.valor_total ?? 0,
      desconto: body.desconto ?? 0,
      observacoes: body.observacao ?? body.observacoes ?? null,
      itens,
    })

    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }

    return NextResponse.json(
      { id: resultado.value.id, link_pagamento: resultado.value.linkPagamento },
      { status: 201 },
    )
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[POST /api/live/[id]/compras]", err)
    return NextResponse.json(erro, { status })
  }
}
