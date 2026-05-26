import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const { searchParams } = req.nextUrl
  const busca = searchParams.get("busca")

  const sb = createServerClient()

  // Busca todas as vendas do cliente
  const { data: vendas, error: errVendas } = await sb
    .from("vendas")
    .select("id")
    .eq("cliente_id", id)

  if (errVendas) return NextResponse.json({ erro: "Erro ao buscar vendas." }, { status: 500 })

  const vendaIds = (vendas ?? []).map((v: { id: number }) => v.id)

  if (vendaIds.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // Busca itens dessas vendas
  let q = sb
    .from("venda_itens")
    .select("produto_id, nome, preco_unit, venda_id")
    .in("venda_id", vendaIds)

  if (busca) q = (q as typeof q).ilike("nome", `%${busca}%`)

  const { data: itens, error: errItens } = await q.order("nome")

  if (errItens) return NextResponse.json({ erro: "Erro ao buscar itens." }, { status: 500 })

  // Agrupa por produto (nome + produto_id), conta quantas vezes foi comprado
  const mapa = new Map<string, { produto_id: number | null; nome: string; preco_unit: number; qtd_compras: number; venda_ids: number[] }>()
  for (const item of (itens ?? []) as { produto_id: number | null; nome: string; preco_unit: number; venda_id: number }[]) {
    const chave = item.produto_id ? `p${item.produto_id}` : `n${item.nome}`
    if (!mapa.has(chave)) {
      mapa.set(chave, { produto_id: item.produto_id, nome: item.nome, preco_unit: item.preco_unit, qtd_compras: 0, venda_ids: [] })
    }
    const entry = mapa.get(chave)!
    entry.qtd_compras++
    if (!entry.venda_ids.includes(item.venda_id)) entry.venda_ids.push(item.venda_id)
  }

  const data = Array.from(mapa.values()).sort((a, b) => b.qtd_compras - a.qtd_compras)

  return NextResponse.json({ data })
}
