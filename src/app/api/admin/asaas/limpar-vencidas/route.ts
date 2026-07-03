import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const ASAAS_BASE = process.env.ASAAS_URL ?? "https://api.asaas.com/v3"
const CORTE = "2026-06-30"

async function listarVencidas(): Promise<{ id: string; customer: string; value: number; dueDate: string }[]> {
  const token = process.env.ASAAS_TOKEN!
  const todas: { id: string; customer: string; value: number; dueDate: string }[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const url = `${ASAAS_BASE}/payments?status=OVERDUE&dueDateLe=${CORTE}&limit=${limit}&offset=${offset}`
    const res = await fetch(url, {
      headers: { access_token: token, "Content-Type": "application/json" },
    })
    if (!res.ok) throw new Error(`Asaas list error ${res.status}: ${await res.text()}`)
    const json = await res.json()
    const items: { id: string; customer: string; value: number; dueDate: string }[] = json.data ?? []
    todas.push(...items)
    if (!json.hasMore) break
    offset += limit
  }

  return todas
}

/** GET — dry run: lista quantas cobranças seriam removidas */
export const GET = withAuth(async () => {
  try {
    const cobranças = await listarVencidas()
    const total = cobranças.reduce((s, c) => s + c.value, 0)
    return NextResponse.json({
      modo: "dry-run",
      quantidade: cobranças.length,
      valor_total: total,
      corte: CORTE,
      aviso: "Nenhuma cobrança foi excluída. Envie POST com { confirmar: true } para apagar.",
      preview: cobranças.slice(0, 10).map(c => ({ id: c.id, valor: c.value, vencimento: c.dueDate })),
    })
  } catch (err) {
    console.error("[admin/asaas/limpar-vencidas GET]", err)
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
})

/** POST { confirmar: true } — apaga de fato todas as cobranças vencidas até CORTE */
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    if (!body.confirmar) {
      return NextResponse.json({
        erro: "Envie { confirmar: true } para confirmar a exclusão permanente.",
      }, { status: 400 })
    }

    const token = process.env.ASAAS_TOKEN!
    const cobranças = await listarVencidas()
    if (cobranças.length === 0) {
      return NextResponse.json({ mensagem: "Nenhuma cobrança vencida encontrada.", excluidas: 0 })
    }

    let excluidas = 0
    const erros: { id: string; erro: string }[] = []

    for (const c of cobranças) {
      const res = await fetch(`${ASAAS_BASE}/payments/${c.id}`, {
        method: "DELETE",
        headers: { access_token: token, "Content-Type": "application/json" },
      })
      if (res.ok || res.status === 404) {
        excluidas++
      } else {
        const txt = await res.text()
        erros.push({ id: c.id, erro: `HTTP ${res.status}: ${txt}` })
      }
    }

    return NextResponse.json({
      excluidas,
      erros: erros.length,
      detalhes_erros: erros.slice(0, 20),
      corte: CORTE,
    })
  } catch (err) {
    console.error("[admin/asaas/limpar-vencidas POST]", err)
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
})
