import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

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
  if (error) return NextResponse.json({ erro: "Erro ao buscar produtos." }, { status: 500 })

  const rows = (data ?? []).map(p => ({ ...p, categoria_nome: (p.categorias as {nome:string}|null)?.nome ?? null, categorias: undefined }))
  return NextResponse.json({ data: rows, total: count })
}

export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const body = await req.json()
  const { nome, codigo, categoria_id, marca, preco_venda, preco_custo, estoque_atual, controlar_estoque, unidade_medida } = body

  if (!nome) return NextResponse.json({ erro: "Nome é obrigatório." }, { status: 400 })

  const sb = createServerClient()
  let cod = codigo
  if (!cod) {
    const { data: nextCod } = await sb.rpc("fn_next_produto_codigo")
    cod = String(nextCod ?? "00001")
  }

  const { data, error } = await sb.from("produtos")
    .insert({
      nome, codigo: cod,
      categoria_id: categoria_id ?? null,
      marca: marca ?? null,
      preco_venda: preco_venda ?? 0,
      preco_custo: preco_custo ?? 0,
      estoque_atual: estoque_atual ?? 0,
      controlar_estoque: controlar_estoque !== false,
      unidade_medida: unidade_medida ?? "un",
    })
    .select().single()

  if (error) {
    if (error.code === "23505") return NextResponse.json({ erro: "Código já existe." }, { status: 409 })
    return NextResponse.json({ erro: "Erro ao criar produto." }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
