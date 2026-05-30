import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const { quantidade, operacao } = await req.json()
  const sb = createServerClient()

  if (operacao === "add" || operacao === "sub") {
    const { data: prod } = await sb.from("produtos").select("estoque_atual").eq("id", id).single()
    if (!prod) return NextResponse.json({ erro: "Produto não encontrado." }, { status: 404 })
    const novo = operacao === "add" ? prod.estoque_atual + quantidade : Math.max(0, prod.estoque_atual - quantidade)
    const { data } = await sb.from("produtos").update({ estoque_atual: novo }).eq("id", id).select("estoque_atual").single()
    return NextResponse.json(data)
  }

  const { data } = await sb.from("produtos").update({ estoque_atual: quantidade }).eq("id", id).select("estoque_atual").single()
  return NextResponse.json(data)
}
