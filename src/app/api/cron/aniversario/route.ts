import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { enviarTexto } from "@/lib/zapi"
import { requireCronAuth } from "@/lib/server-guards"
import { readIntEnv } from "@/lib/server-env"
import calendarData from "@/data/ui/calendar.json"

const MESES = calendarData.months


export const dynamic = "force-dynamic"

function montarMensagem(nome: string, mes: number): string {
  const nomePrimeiro = nome.trim().split(" ")[0]
  const nomeMes = MESES[mes - 1]
  return (
    `🎂 Feliz Aniversário, ${nomePrimeiro}! 🥳\n\n` +
    `Que dia especial — hoje é o SEU dia e aqui da Brechó Bellasu a gente não ia deixar passar sem celebrar com você! 💕\n\n` +
    `De presente, preparamos um miminho especial só pra você:\n\n` +
    `✨ *15% de desconto* em qualquer peça da nossa coleção!\n\n` +
    `É só mostrar essa mensagem quando vier nos visitar ou falar aqui pelo WhatsApp. Válido durante todo o mês de *${nomeMes}*! 🗓️👗\n\n` +
    `Você faz parte da família Bellasu e merece se sentir linda hoje e sempre! 💖\n\n` +
    `Muitas felicidades! 🎉🎊🥂\n` +
    `— Brechó Bellasu 🛍️`
  )
}

// GET /api/cron/aniversario — Vercel Cron: roda todo dia às 8h (11:00 UTC)
export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  const startedAt = Date.now()
  const maxEnvios = readIntEnv("ANIVERSARIO_CRON_MAX_ENVIOS", 8, 1, 50)
  const maxRuntimeMs = readIntEnv("ANIVERSARIO_CRON_MAX_RUNTIME_MS", 45_000, 10_000, 240_000)
  const safetyWindowMs = 20_000
  const sb = createServerClient()

  // Dia e mês em horário de Brasília (UTC-3)
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const mes = agora.getUTCMonth() + 1
  const dia = agora.getUTCDate()
  const anoAtual = agora.getUTCFullYear()

  // Busca todas as ativas com celular e data de nascimento
  const { data: clientes } = await sb
    .from("clientes")
    .select("id, nome, celular, data_nasc, aniversario_msg_ano")
    .eq("ativo", true)
    .not("data_nasc", "is", null)
    .not("celular", "is", null)

  // Filtra aniversariantes de hoje que ainda não receberam mensagem este ano
  const aniversariantes = (clientes ?? []).filter(c => {
    if (!c.data_nasc) return false
    const [, m, d] = c.data_nasc.split("-").map(Number)
    return m === mes && d === dia && c.aniversario_msg_ano !== anoAtual
  }).sort((a, b) => Number(a.id) - Number(b.id))

  if (!aniversariantes.length) {
    return NextResponse.json({ ok: true, total: 0, mensagem: "Nenhuma aniversariante hoje." })
  }

  const resultados: Array<{ id: number; nome: string; ok: boolean; erro?: string }> = []
  const lote = aniversariantes.slice(0, maxEnvios)

  for (const c of lote) {
    if (Date.now() - startedAt > maxRuntimeMs - safetyWindowMs) break

    const mensagem = montarMensagem(c.nome ?? "Cliente", mes)

    const result = await enviarTexto(c.celular!, mensagem, "aniversario")

    // Marca o ano do envio para não disparar duas vezes
    if (result.ok) {
      await sb.from("clientes")
        .update({ aniversario_msg_ano: anoAtual })
        .eq("id", c.id)
    }

    resultados.push({ id: c.id, nome: c.nome ?? "", ok: result.ok, erro: result.erro })
  }

  return NextResponse.json({
    ok: true,
    total: aniversariantes.length,
    processadas: resultados.length,
    pendentes: Math.max(0, aniversariantes.length - resultados.length),
    limite_envios: maxEnvios,
    enviadas: resultados.filter(r => r.ok).length,
    erros: resultados.filter(r => !r.ok).length,
    resultados,
  })
}
