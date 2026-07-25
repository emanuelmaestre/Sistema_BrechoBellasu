import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

// GET — lista todas as campanhas (rascunhos + enviadas), mais recentes primeiro
export async function GET() {
  const sb = createServerClient()
  const { data, error } = await sb
    .from("campanhas")
    .select("*")
    .order("criado_em", { ascending: false })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ campanhas: data ?? [] })
}

// POST — cria ou atualiza rascunho
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    id?: number
    texto: string
    midia_tipo?: string | null
    midia_url?: string | null
    midia_nome?: string | null
  }

  const sb = createServerClient()
  const payload = {
    texto:      body.texto ?? "",
    midia_tipo: body.midia_tipo ?? null,
    midia_url:  body.midia_url ?? null,
    midia_nome: body.midia_nome ?? null,
    status:     "rascunho" as const,
  }

  let data, error
  if (body.id) {
    ;({ data, error } = await sb.from("campanhas").update(payload).eq("id", body.id).select().single())
  } else {
    ;({ data, error } = await sb.from("campanhas").insert(payload).select().single())
  }

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ campanha: data })
}

// PATCH — atualiza status/stats de uma campanha (?id=X)
export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 })

  const body = await req.json() as {
    status?: "rascunho" | "enviando" | "enviada"
    total_clientes?: number
    enviado_em?: string | null
  }

  const sb = createServerClient()
  const { error } = await sb.from("campanhas").update(body).eq("id", id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — exclui campanha por id (?id=X)
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 })

  const sb = createServerClient()

  // Remove mídia do Storage se houver
  const { data: camp } = await sb.from("campanhas").select("midia_nome").eq("id", id).single()
  if (camp?.midia_nome) {
    try { await sb.storage.from("campanhas").remove([camp.midia_nome]) } catch { /* ignora */ }
  }

  const { error } = await sb.from("campanhas").delete().eq("id", id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
