import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

export const dynamic = "force-dynamic"

// GET /api/aniversariantes/hoje — lista clientes que fazem aniversário hoje
export const GET = withAuth(async () => {
  const sb = createServerClient()

  // Dia e mês em horário de Brasília (UTC-3)
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const mes = agora.getUTCMonth() + 1
  const dia = agora.getUTCDate()

  const { data } = await sb
    .from("clientes")
    .select("id, nome, apelido, celular, data_nasc, aniversario_msg_ano")
    .eq("ativo", true)
    .not("data_nasc", "is", null)
    .not("celular", "is", null)

  const anoAtual = agora.getUTCFullYear()

  const aniversariantes = (data ?? []).filter(c => {
    if (!c.data_nasc) return false
    const [, m, d] = c.data_nasc.split("-").map(Number)
    return m === mes && d === dia
  }).map(c => ({
    id:        c.id,
    nome:      c.nome,
    apelido:   c.apelido,
    celular:   c.celular,
    data_nasc: c.data_nasc,
    msgEnviada: c.aniversario_msg_ano === anoAtual,
  }))

  return NextResponse.json({ total: aniversariantes.length, aniversariantes })
})
