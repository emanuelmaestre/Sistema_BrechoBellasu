import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const sb = createServerClient()
  const { data, error } = await sb.from("produtos").select("*, categorias(nome)").eq("id", id).single()
  if (error || !data) return NextResponse.json({ erro: "Produto não encontrado." }, { status: 404 })
  return NextResponse.json({ ...data, categoria_nome: (data.categorias as {nome:string}|null)?.nome ?? null, categorias: undefined })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { nome, codigo, categoria_id, marca, preco_venda, preco_custo, estoque_atual, controlar_estoque, unidade_medida } = body

  if (!nome) return NextResponse.json({ erro: "Nome é obrigatório." }, { status: 400 })

  const sb = createServerClient()
  const { data, error } = await sb.from("produtos")
    .update({ nome, codigo: codigo ?? null, categoria_id: categoria_id ?? null, marca: marca ?? null, preco_venda: preco_venda ?? 0, preco_custo: preco_custo ?? 0, estoque_atual: estoque_atual ?? 0, controlar_estoque: controlar_estoque !== false, unidade_medida: unidade_medida ?? "un" })
    .eq("id", id).select().single()

  if (error) {
    if (error.code === "23505") return NextResponse.json({ erro: "Código já existe." }, { status: 409 })
    return NextResponse.json({ erro: "Erro ao atualizar produto." }, { status: 500 })
  }
  if (!data) return NextResponse.json({ erro: "Produto não encontrado." }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const sb = createServerClient()
  const { error } = await sb.from("produtos").delete().eq("id", id)
  if (error) return NextResponse.json({ erro: "Erro ao excluir produto." }, { status: 500 })
  return NextResponse.json({ ok: true })
}
