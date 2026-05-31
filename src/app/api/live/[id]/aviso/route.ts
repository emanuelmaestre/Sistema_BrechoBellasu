import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { enviarTexto } from "@/lib/zapi"

export const dynamic = "force-dynamic"

// POST /api/live/[id]/aviso — Dispara aviso de live para clientes que aceitam notificações
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const liveId = parseInt(id)
  const { link } = await req.json() as { link?: string }

  const sb = createServerClient()

  // Busca live
  const { data: live } = await sb
    .from("lives")
    .select("id, titulo, tipo, status, link_live")
    .eq("id", liveId)
    .single()

  if (!live) return NextResponse.json({ erro: "Live não encontrada." }, { status: 404 })
  if (live.status === "encerrada") return NextResponse.json({ erro: "Live já encerrada." }, { status: 400 })

  const linkFinal = link || live.link_live
  if (!linkFinal) return NextResponse.json({ erro: "Link da live é obrigatório." }, { status: 400 })

  // Salva link na live
  if (link) {
    await sb.from("lives").update({ link_live: link }).eq("id", liveId)
  }

  // Busca clientes que aceitam lives
  const { data: clientes } = await sb
    .from("clientes")
    .select("id, nome, celular")
    .eq("aceita_lives", "confirmado")
    .eq("ativo", true)
    .not("celular", "is", null)

  if (!clientes?.length) {
    return NextResponse.json({ ok: true, enviados: 0, mensagem: "Nenhum cliente com opt-in para lives." })
  }

  const tipo = (live.tipo ?? "novidades") as string

  const mensagem = tipo === "promocional"
    ? `🏷️ Estamos *AO VIVO* com *PROMOÇÕES* agora!\n\nAcesse aqui: ${linkFinal}\n\nCorre! 🔥`
    : `✨ Estamos *AO VIVO* com *NOVIDADES* agora!\n\nAcesse aqui: ${linkFinal}\n\nTe esperamos! 💖`

  // Dispara em paralelo (máx 5 por vez para não sobrecarregar)
  let enviados = 0
  let erros = 0
  const batchSize = 5

  for (let i = 0; i < clientes.length; i += batchSize) {
    const batch = clientes.slice(i, i + batchSize)
    const resultados = await Promise.allSettled(
      batch.map(c => enviarTexto(c.celular!, mensagem, "aviso_live"))
    )
    for (const r of resultados) {
      if (r.status === "fulfilled" && r.value.ok) enviados++
      else erros++
    }
  }

  return NextResponse.json({ ok: true, enviados, erros, total: clientes.length })
}
