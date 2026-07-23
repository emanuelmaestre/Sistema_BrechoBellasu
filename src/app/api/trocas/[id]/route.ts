import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

export const PUT = withAuth(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id: rawId } = await ctx.params
    const id = parseInt(rawId)
    if (!id) return NextResponse.json({ erro: "ID inválido" }, { status: 400 })

    const body = await req.json()
    const sb = createServerClient()

    const patch: Record<string, unknown> = {}
    if (body.tipo         !== undefined) patch.tipo          = body.tipo
    if (body.motivo       !== undefined) patch.motivo        = body.motivo
    if (body.nome_produto !== undefined) patch.nome_produto  = body.nome_produto
    if (body.produto_id   !== undefined) patch.produto_id    = body.produto_id
    if (body.cliente_id   !== undefined) patch.cliente_id    = body.cliente_id
    if (body.cliente_nome !== undefined) patch.cliente_nome  = body.cliente_nome
    if (body.status       !== undefined) patch.status        = body.status

    if (Object.keys(patch).length === 0)
      return NextResponse.json({ erro: "Nenhum campo para atualizar" }, { status: 400 })

    const { error } = await sb.from("trocas").update(patch).eq("id", id)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    return NextResponse.json(erro, { status })
  }
})
