import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { enviarConsentimentoCliente } from "@/lib/consentimento-agent"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET — lista clientes com consentimento não enviado (status null ou erro)
export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const sb = createServerClient()
  const { data, error } = await sb
    .from("clientes")
    .select("id, nome, celular")
    .or("notificacao_status.is.null,notificacao_status.eq.erro")
    .eq("ativo", true)
    .not("celular", "is", null)
    .order("nome")

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({
    total: data?.length ?? 0,
    clientes: (data ?? []).map(c => ({ id: c.id, nome: c.nome })),
  })
}

// POST — envia consentimento para um cliente específico
export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { cliente_id } = await req.json().catch(() => ({})) as { cliente_id?: number }
  if (!cliente_id) return NextResponse.json({ erro: "cliente_id obrigatório." }, { status: 400 })

  const sb = createServerClient()
  const { data: cliente } = await sb
    .from("clientes")
    .select("id, nome, celular")
    .eq("id", cliente_id)
    .eq("ativo", true)
    .or("notificacao_status.is.null,notificacao_status.eq.erro")
    .not("celular", "is", null)
    .single()

  if (!cliente) {
    return NextResponse.json({ id: cliente_id, status: "ignorado", detalhe: "Cliente não encontrado ou já enviado." })
  }

  const resultado = await enviarConsentimentoCliente({
    clienteId: cliente.id,
    nome: cliente.nome ?? "Cliente",
    celular: cliente.celular,
    tipo: "inicial",
  })

  return NextResponse.json({
    id: cliente.id,
    nome: cliente.nome,
    status: resultado.ok ? "enviado" : "erro",
    detalhe: resultado.erro ?? ((resultado as { skipped?: boolean; motivo?: string }).skipped ? (resultado as { skipped?: boolean; motivo?: string }).motivo : undefined),
  })
}
