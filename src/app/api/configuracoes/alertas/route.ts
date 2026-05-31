import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

// GET /api/configuracoes/alertas — Retorna configurações de alertas
export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const sb = createServerClient()
  const { data } = await sb.from("config_alertas").select("chave, valor")

  const config: Record<string, string> = {}
  for (const row of data ?? []) config[row.chave] = row.valor

  return NextResponse.json(config)
}

// PUT /api/configuracoes/alertas — Atualiza configurações de alertas
export async function PUT(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const body = await req.json() as Record<string, string>
  const sb = createServerClient()

  for (const [chave, valor] of Object.entries(body)) {
    await sb.from("config_alertas")
      .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: "chave" })
  }

  return NextResponse.json({ ok: true })
}
