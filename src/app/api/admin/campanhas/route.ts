import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAdminAuth } from "@/lib/with-auth"
import {
  normalizeCampaignMedia,
  normalizeCampaignText,
  parsePositiveInteger,
} from "@/lib/campanha-seguranca"

export const dynamic = "force-dynamic"

export const GET = withAdminAuth(async () => {
  const sb = createServerClient()
  const { data, error } = await sb
    .from("campanhas")
    .select("*")
    .order("criado_em", { ascending: false })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(
    { campanhas: data ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  )
})

export const POST = withAdminAuth(async (req: NextRequest) => {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ erro: "JSON invalido." }, { status: 400 })

  const texto = normalizeCampaignText(body.texto)
  const media = normalizeCampaignMedia(body)
  if (!texto) {
    return NextResponse.json(
      { erro: "A mensagem deve ter entre 1 e 800 caracteres." },
      { status: 400 }
    )
  }
  if (!media) {
    return NextResponse.json({ erro: "Dados de midia invalidos." }, { status: 400 })
  }

  const sb = createServerClient()
  const payload = {
    texto,
    ...media,
    status: "rascunho" as const,
    total_clientes: 0,
    enviadas: 0,
    erros: 0,
    enviado_em: null,
  }

  let data
  let error
  const id = body.id === undefined ? null : parsePositiveInteger(body.id)
  if (body.id !== undefined && !id) {
    return NextResponse.json({ erro: "id invalido." }, { status: 400 })
  }

  if (id) {
    const { data: existing } = await sb
      .from("campanhas")
      .select("status")
      .eq("id", id)
      .single()
    if (!existing) {
      return NextResponse.json({ erro: "Campanha nao encontrada." }, { status: 404 })
    }
    if (existing.status === "enviando") {
      return NextResponse.json(
        { erro: "Nao e possivel editar uma campanha em andamento." },
        { status: 409 }
      )
    }

    ;({ data, error } = await sb
      .from("campanhas")
      .update(payload)
      .eq("id", id)
      .select()
      .single())
    if (!error) await sb.from("campanha_envios").delete().eq("campanha_id", id)
  } else {
    ;({ data, error } = await sb.from("campanhas").insert(payload).select().single())
  }

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ campanha: data })
})

export const PATCH = withAdminAuth(async (req: NextRequest) => {
  const id = parsePositiveInteger(req.nextUrl.searchParams.get("id"))
  if (!id) return NextResponse.json({ erro: "id obrigatorio" }, { status: 400 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ erro: "JSON invalido." }, { status: 400 })

  const updates: Record<string, string | number | null> = {}
  if (body.status !== undefined) {
    if (!["rascunho", "enviando", "enviada"].includes(String(body.status))) {
      return NextResponse.json({ erro: "Status invalido." }, { status: 400 })
    }
    updates.status = String(body.status)
  }
  if (body.total_clientes !== undefined) {
    const total = Number(body.total_clientes)
    if (!Number.isSafeInteger(total) || total < 0 || total > 100_000) {
      return NextResponse.json(
        { erro: "total_clientes invalido." },
        { status: 400 }
      )
    }
    updates.total_clientes = total
  }
  if (body.enviado_em !== undefined) {
    if (
      body.enviado_em !== null &&
      (typeof body.enviado_em !== "string" ||
        !Number.isFinite(Date.parse(body.enviado_em)))
    ) {
      return NextResponse.json({ erro: "enviado_em invalido." }, { status: 400 })
    }
    updates.enviado_em = body.enviado_em as string | null
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { erro: "Nenhuma alteracao valida." },
      { status: 400 }
    )
  }

  const sb = createServerClient()
  const { error } = await sb.from("campanhas").update(updates).eq("id", id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})

export const DELETE = withAdminAuth(async (req: NextRequest) => {
  const id = parsePositiveInteger(req.nextUrl.searchParams.get("id"))
  if (!id) return NextResponse.json({ erro: "id obrigatorio" }, { status: 400 })

  const sb = createServerClient()
  const { data: camp } = await sb
    .from("campanhas")
    .select("midia_nome,status")
    .eq("id", id)
    .single()
  if (!camp) {
    return NextResponse.json({ erro: "Campanha nao encontrada." }, { status: 404 })
  }
  if (camp.status === "enviando") {
    return NextResponse.json(
      { erro: "Nao e possivel excluir uma campanha em andamento." },
      { status: 409 }
    )
  }

  if (camp.midia_nome) {
    try {
      await sb.storage.from("campanhas").remove([camp.midia_nome])
    } catch {
      // A exclusao do registro continua; midia orfa pode ser limpa depois.
    }
  }

  const { error } = await sb.from("campanhas").delete().eq("id", id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})
