import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { classificarResposta } from "@/lib/consentimento-resposta"
import { requireCronAuth } from "@/lib/server-guards"

export const dynamic = "force-dynamic"

function gerarVariantesNumero(telefone: string): string[] {
  const variants = new Set<string>()
  const limpo = telefone.replace(/\D/g, "")
  variants.add(limpo)
  const semDDI = limpo.startsWith("55") ? limpo.substring(2) : limpo
  const comDDI = limpo.startsWith("55") ? limpo : `55${limpo}`
  variants.add(semDDI)
  variants.add(comDDI)
  if (semDDI.length === 11) {
    const s = semDDI.substring(0, 2) + semDDI.substring(3)
    variants.add(s)
    variants.add(`55${s}`)
  } else if (semDDI.length === 10) {
    const c = semDDI.substring(0, 2) + "9" + semDDI.substring(2)
    variants.add(c)
    variants.add(`55${c}`)
  }
  return Array.from(variants)
}

// GET /api/cron/corrigir-consentimento — Vercel Cron: roda todo dia às 3h (06:00 UTC)
// Corrige clientes com status "enviado" que já responderam sim/não mas o webhook não capturou.
export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  const sb = createServerClient()

  const { data: clientesEnviados } = await sb
    .from("clientes")
    .select("id, nome, celular, notificacao_status, aceita_novidades, consentimento_enviado_em")
    .eq("notificacao_status", "enviado")
    .eq("aceita_novidades", "aguardando")
    .not("celular", "is", null)
    .limit(500)

  if (!clientesEnviados?.length) {
    return NextResponse.json({ ok: true, total_corrigidos: 0, mensagem: "Nenhum cliente pendente." })
  }

  const { data: logs } = await sb
    .from("whatsapp_log")
    .select("telefone, mensagem, created_at")
    .eq("tipo", "recebida")
    .order("created_at", { ascending: false })
    .limit(5000)

  const logsPorTel = new Map<string, { mensagem: string; created_at: string }[]>()
  for (const log of logs ?? []) {
    const t = (log.telefone ?? "").replace(/\D/g, "")
    if (!logsPorTel.has(t)) logsPorTel.set(t, [])
    logsPorTel.get(t)!.push({ mensagem: log.mensagem, created_at: log.created_at })
  }

  const corrigidos: Array<{ id: number; nome: string; acao: string; ok: boolean; erro?: string }> = []

  for (const cliente of clientesEnviados) {
    const variantes = gerarVariantesNumero(cliente.celular ?? "")
    let encontrado: { mensagem: string; created_at: string } | null = null

    for (const v of variantes) {
      const entradas = logsPorTel.get(v) ?? []
      const enviadoEm = cliente.consentimento_enviado_em ? new Date(cliente.consentimento_enviado_em).getTime() : 0
      const respostas = entradas.filter(e =>
        classificarResposta(e.mensagem ?? "") !== null &&
        new Date(e.created_at).getTime() > enviadoEm,
      )
      if (respostas.length > 0) {
        encontrado = respostas.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
        break
      }
    }

    if (!encontrado) continue

    const ehSim = classificarResposta(encontrado.mensagem ?? "") === "sim"
    const novoStatus = ehSim ? "autorizado" : "recusado"
    const novoConsent = ehSim ? "confirmado" : "recusado"

    const { error } = await sb.from("clientes")
      .update({
        notificacao_status: novoStatus,
        aceita_novidades: novoConsent,
        aceita_lives: novoConsent,
        consentimento_respondido_em: encontrado.created_at,
      })
      .eq("id", cliente.id)

    corrigidos.push({ id: cliente.id, nome: cliente.nome ?? "", acao: novoStatus, ok: !error, erro: error?.message })
  }

  return NextResponse.json({
    ok: true,
    total_pendentes: clientesEnviados.length,
    total_corrigidos: corrigidos.length,
    autorizados: corrigidos.filter(c => c.acao === "autorizado").length,
    recusados: corrigidos.filter(c => c.acao === "recusado").length,
    corrigidos,
  })
}
