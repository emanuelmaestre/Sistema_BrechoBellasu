import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { CriarProdutoUseCase } from "@/application/produtos/criar-produto.use-case"
import { ListarProdutosUseCase } from "@/application/produtos/listar-produtos.use-case"
import { ProdutoRepositorySupabase } from "@/infrastructure/repositories/produto.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = req.nextUrl
    const sb = createServerClient()
    const useCase = new ListarProdutosUseCase(new ProdutoRepositorySupabase(sb))

    const result = await useCase.execute({
      busca: searchParams.get("busca"),
      categoriaId: searchParams.get("categoria_id"),
      marca: searchParams.get("marca"),
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "50"),
      ordemCodigo: searchParams.get("ordem_codigo") === "desc" ? "desc" : "asc",
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error("[GET /api/produtos]", err)
    return NextResponse.json({ erro: "Nao foi possivel carregar os produtos. Tente novamente." }, { status: 500 })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const sb = createServerClient()

    const useCase = new CriarProdutoUseCase(new ProdutoRepositorySupabase(sb))

    const resultado = await useCase.execute({
      nome: body.nome,
      codigo: body.codigo?.trim() || null,
      categoriaId: body.categoria_id ?? null,
      marca: body.marca ?? null,
      precoVenda: body.preco_venda ?? 0,
      precoCusto: body.preco_custo ?? 0,
      estoqueAtual: body.estoque_atual ?? 0,
      controlarEstoque: body.controlar_estoque,
      unidadeMedida: body.unidade_medida,
      cor: body.cor ?? null,
      tamanho: body.tamanho ?? null,
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
})
