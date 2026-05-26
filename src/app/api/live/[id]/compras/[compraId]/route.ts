import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

type Params = { params: Promise<{ id: string; compraId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { compraId } = await params
  const body = await req.json()
  const sb = createServerClient()

  const campos: Record<string, unknown> = {}
  const permitidos = ["nome_cliente","whatsapp","cor_sacola","numero_sacola","quantidade_itens","quantidade_volumes","valor_total","desconto","observacao","status_compra"]
  for (const k of permitidos) { if (body[k] !== undefined) campos[k] = body[k] }

  const { error } = await sb.from("live_compras").update(campos).eq("id", parseInt(compraId))
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { compraId } = await params
  const sb = createServerClient()

  const { error } = await sb.from("live_compras").delete().eq("id", parseInt(compraId))
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
