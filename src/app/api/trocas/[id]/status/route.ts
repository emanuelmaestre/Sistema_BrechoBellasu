import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { AtualizarStatusTrocaUseCase } from "@/application/trocas/troca.use-cases"
import { TrocaRepositorySupabase } from "@/infrastructure/repositories/troca.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"
import { enviarTexto } from "@/lib/zapi"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  try {
    const { id } = await params
    const trocaId = parseInt(id)
    const { status, decisao_produto, resultado_fin } = await req.json()
    const sb = createServerClient()
    const useCase = new AtualizarStatusTrocaUseCase(new TrocaRepositorySupabase(sb))

    const resultado = await useCase.execute(
      trocaId,
      status,
      decisao_produto ?? null,
      resultado_fin ?? null,
    )

    if (!resultado.ok) {
      const { status: st, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status: st })
    }

    // ── Notificação WhatsApp ao aprovar/recusar ──
    if (status === "aprovada" || status === "recusada") {
      try {
        const { data: troca } = await sb
          .from("trocas")
          .select("tipo, cliente_id")
          .eq("id", trocaId)
          .single()

        if (troca?.cliente_id) {
          const { data: cliente } = await sb
            .from("clientes")
            .select("nome, celular")
            .eq("id", troca.cliente_id)
            .single()

          if (cliente?.celular) {
            const nome = cliente.nome?.split(" ")[0] ?? "Cliente"
            const tipoTexto = troca.tipo === "devolucao" ? "devolução" : "troca"

            const mensagem = status === "aprovada"
              ? `Oi ${nome}! Sua solicitação de *${tipoTexto}* foi *APROVADA* ✅. Em breve entraremos em contato com os próximos passos.`
              : `Oi ${nome}! Sua solicitação de *${tipoTexto}* foi *RECUSADA* ❌. Caso tenha dúvidas, entre em contato conosco.`

            // Dispara assíncrono (não bloqueia resposta)
            enviarTexto(
              cliente.celular,
              mensagem,
              status === "aprovada" ? "troca_aprovada" : "troca_recusada",
            ).catch(() => {})
          }
        }
      } catch { /* não falha a operação principal */ }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[PATCH /api/trocas/[id]/status]", err)
    return NextResponse.json(erro, { status })
  }
}
