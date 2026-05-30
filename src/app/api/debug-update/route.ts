import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const sb = createServerClient()
  const log: string[] = []

  // 1. Ler compra 23 antes do update
  const { data: antes, error: errAntes } = await sb
    .from("live_compras").select("id, msg_status, live_id").eq("id", 23).single()
  log.push(`1-READ: ${JSON.stringify({ data: antes, error: errAntes?.message })}`)

  // 2. Tentar update msg_status via Supabase client (com .select())
  const { data: upd, error: errUpd, count } = await sb
    .from("live_compras")
    .update({ msg_status: "enviada" })
    .eq("id", 23)
    .select("id, msg_status")
  log.push(`2-UPDATE+SELECT: ${JSON.stringify({ data: upd, error: errUpd?.message, count })}`)

  // 3. Ler novamente pra verificar
  const { data: depois, error: errDepois } = await sb
    .from("live_compras").select("id, msg_status").eq("id", 23).single()
  log.push(`3-VERIFY: ${JSON.stringify({ data: depois, error: errDepois?.message })}`)

  // 4. Se ainda pendente, tentar via REST direto
  if (depois?.msg_status !== "enviada") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    log.push(`4-ENV: url=${url ? "SET" : "MISSING"}, key=${key ? key.substring(0, 10) + "..." : "MISSING"}`)

    try {
      const resp = await fetch(`${url}/rest/v1/live_compras?id=eq.23`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": key!,
          "Authorization": `Bearer ${key}`,
          "Prefer": "return=representation",
        },
        body: JSON.stringify({ msg_status: "enviada" }),
      })
      const body = await resp.text()
      log.push(`5-REST: status=${resp.status}, body=${body.substring(0, 500)}`)
    } catch (e: unknown) {
      log.push(`5-REST-ERR: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 6. Ler de novo
    const { data: final } = await sb
      .from("live_compras").select("id, msg_status").eq("id", 23).single()
    log.push(`6-FINAL: ${JSON.stringify(final)}`)
  }

  // 7. Reverter para pendente (cleanup)
  await sb.from("live_compras").update({ msg_status: "pendente" }).eq("id", 23)
  const { data: cleanup } = await sb
    .from("live_compras").select("id, msg_status").eq("id", 23).single()
  log.push(`7-CLEANUP: ${JSON.stringify(cleanup)}`)

  return NextResponse.json({ log })
}
