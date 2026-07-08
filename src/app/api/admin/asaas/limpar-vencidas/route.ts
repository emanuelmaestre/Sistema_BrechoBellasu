import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const ASAAS_BASE = process.env.ASAAS_URL ?? "https://api.asaas.com/v3"
const CORTE = "2026-07-06"

type AsaasPayment = { id: string; customer: string; value: number; dueDate: string; status: string }

/** Busca todos os asaas_payment_id registrados em live_compras */
async function buscarIdsLive(): Promise<Set<string>> {
  const sb = createServerClient()
  const { data } = await sb
    .from("live_compras")
    .select("asaas_payment_id")
    .not("asaas_payment_id", "is", null)
  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (row.asaas_payment_id) ids.add(row.asaas_payment_id as string)
  }
  return ids
}

/** Lista todas as cobranças PENDING e OVERDUE no Asaas e filtra pelas da live */
async function listarCobrancasLive(): Promise<AsaasPayment[]> {
  const token = process.env.ASAAS_TOKEN!
  const idsLive = await buscarIdsLive()

  if (idsLive.size === 0) return []

  const todas: AsaasPayment[] = []

  for (const status of ["PENDING", "OVERDUE"]) {
    let offset = 0
    const limit = 100
    while (true) {
      const url = `${ASAAS_BASE}/payments?status=${status}&dueDateLe=${CORTE}&limit=${limit}&offset=${offset}`
      const res = await fetch(url, {
        headers: { access_token: token, "Content-Type": "application/json" },
      })
      if (!res.ok) throw new Error(`Asaas list error ${res.status}: ${await res.text()}`)
      const json = await res.json()
      const items: AsaasPayment[] = json.data ?? []
      // Filtra apenas as cobranças geradas pelo módulo Live
      todas.push(...items.filter(c => idsLive.has(c.id)))
      if (!json.hasMore) break
      offset += limit
    }
  }

  // Deduplica (PENDING e OVERDUE podem eventualmente sobrepor)
  const vistos = new Set<string>()
  return todas.filter(c => (vistos.has(c.id) ? false : (vistos.add(c.id), true)))
}

/** GET — dry run: mostra quantas cobranças da live seriam excluídas */
export const GET = withAuth(async () => {
  try {
    const cobracas = await listarCobrancasLive()
    const totalValor = cobracas.reduce((s, c) => s + c.value, 0)
    return NextResponse.json({
      modo: "dry-run",
      quantidade: cobracas.length,
      valor_total: totalValor,
      corte: CORTE,
      aviso: "Nenhuma cobrança foi excluída. Envie POST com { confirmar: true } para apagar.",
      preview: cobracas.slice(0, 10).map(c => ({
        id: c.id,
        valor: c.value,
        vencimento: c.dueDate,
        status: c.status,
      })),
    })
  } catch (err) {
    console.error("[admin/asaas/limpar-vencidas GET]", err)
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
})

/** POST { confirmar: true } — exclui todas as cobranças pendentes/vencidas da live */
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    if (!body.confirmar) {
      return NextResponse.json(
        { erro: "Envie { confirmar: true } para confirmar a exclusão permanente." },
        { status: 400 },
      )
    }

    const token = process.env.ASAAS_TOKEN!
    const cobracas = await listarCobrancasLive()

    if (cobracas.length === 0) {
      return NextResponse.json({ mensagem: "Nenhuma cobrança pendente/vencida da live encontrada.", excluidas: 0 })
    }

    let excluidas = 0
    const erros: { id: string; erro: string }[] = []

    for (const c of cobracas) {
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
    })
  } catch (err) {
    console.error("[admin/asaas/limpar-vencidas POST]", err)
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
})
