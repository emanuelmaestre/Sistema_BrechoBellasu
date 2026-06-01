import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { CriarProdutoUseCase } from "@/application/produtos/criar-produto.use-case"
import { ProdutoRepositorySupabase } from "@/infrastructure/repositories/produto.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Você precisa estar logado para realizar esta ação." }, { status: 401 })

  const { searchParams } = req.nextUrl
  const busca       = searchParams.get("busca")
  const categoria_id = searchParams.get("categoria_id")
  const page        = parseInt(searchParams.get("page") ?? "1")
  const limit       = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)
  const from        = (page - 1) * limit
  const to          = from + limit - 1

  const sb = createServerClient()
  let q = sb.from("produtos").select("*, categorias(nome)", { count: "exact" })
  if (busca)       q = q.or(`nome.ilike.%${busca}%,codigo.ilike.%${busca}%`)
  if (categoria_id) q = q.eq("categoria_id", categoria_id)

  const { data, count, error } = await q.order("nome").range(from, to)
  if (error) return NextResponse.json({ erro: "Não foi possível carregar os produtos. Tente novamente." }, { status: 500 })

  const rows = (data ?? []).map(p => ({ ...p, categoria_nome: (p.categorias as {nome:string}|null)?.nome ?? null, categorias: undefined }))
  return NextResponse.json({ data: rows, total: count })
}

export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Você precisa estar logado para realizar esta ação." }, { status: 401 })

  try {
    const body = await req.json()
    const sb = createServerClient()
    const useCase = new CriarProdutoUseCase(new ProdutoRepositorySupabase(sb))

    const resultado = await useCase.execute({
      nome: body.nome,
      codigo: body.codigo ?? null,
      categoriaId: body.categoria_id ?? null,
      marca: body.marca ?? null,
      precoVenda: body.preco_venda ?? 0,
      precoCusto: body.preco_custo ?? 0,
      estoqueAtual: body.estoque_atual ?? 0,
      controlarEstoque: body.controlar_estoque,
      unidadeMedida: body.unidade_medida,
    })

    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }
    return NextResponse.json({ id: resultado.value.id }, { status: 201 })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[POST /api/produtos]", err)
    return NextResponse.json(erro, { status })
  }
}
