import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { lerConfigDisparo, salvarConfigDisparo } from "@/lib/live-config-disparo"

export const dynamic = "force-dynamic"

// GET ?live_id= — última chave PIX/prazo + prazo original da live (se já disparada)
export const GET = withAuth(async (req: NextRequest) => {
  const cfg = await lerConfigDisparo()
  const liveId = req.nextUrl.searchParams.get("live_id")
  return NextResponse.json({
    chave_pix: cfg.chave_pix,
    dias_prazo: cfg.dias_prazo,
    prazo_da_live: liveId ? cfg.prazo_por_live[liveId] ?? null : null,
  })
})

// POST { chave_pix, dias_prazo, live_id } — chamado ao iniciar um disparo
export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({})) as { chave_pix?: string; dias_prazo?: number; live_id?: number }
  const ok = await salvarConfigDisparo(body)
  if (!ok) return NextResponse.json({ erro: "Não foi possível salvar a chave PIX." }, { status: 500 })
  return NextResponse.json({ ok: true })
})
