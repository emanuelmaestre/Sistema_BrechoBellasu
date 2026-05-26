import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { searchParams } = req.nextUrl
  const de  = searchParams.get("de")
  const ate = searchParams.get("ate")

  const sb = createServerClient()
  let q = sb.from("vendas").select("cliente_id, clientes(nome), total")
  if (de)  q = q.gte("created_at", de)
  if (ate) q = q.lte("created_at", `${ate}T23:59:59`)
  const { data, error } = await q.limit(200)
  if (error) return NextResponse.json({ erro: "Erro ao buscar vendas por cliente." }, { status: 500 })

  const mapa: Record<number, { nome: string; total_compras: number; total_gasto: number }> = {}
  ;(data ?? []).forEach((v) => {
    const id = v.cliente_id ?? 0
    const nome = (v.clientes as unknown as {nome:string}|null)?.nome ?? "Sem cadastro"
    if (!mapa[id]) mapa[id] = { nome, total_compras: 0, total_gasto: 0 }
    mapa[id].total_compras++
    mapa[id].total_gasto += parseFloat(String(v.total ?? 0))
  })

  const rows = Object.values(mapa).sort((a, b) => b.total_gasto - a.total_gasto)
  return NextResponse.json(rows)
}
