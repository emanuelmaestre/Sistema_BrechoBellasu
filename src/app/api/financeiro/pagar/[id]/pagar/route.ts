import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const sb = createServerClient()
  const { data, error } = await sb.from("contas_pagar")
    .update({ status: "pago", data_pagamento: new Date().toISOString().split("T")[0] })
    .eq("id", id).select().single()

  if (error) return NextResponse.json({ erro: "Erro ao pagar conta." }, { status: 500 })
  return NextResponse.json(data)
}
