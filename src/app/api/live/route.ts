import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { CriarLiveUseCase, ListarLivesUseCase } from "@/application/live"
import { LiveRepositorySupabase } from "@/infrastructure/repositories/live.repository"
import { apresentarErro } from "@/infrastructure/http/error-presenter"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = req.nextUrl
    const useCase = new ListarLivesUseCase(new LiveRepositorySupabase(createServerClient()))
    const resultado = await useCase.execute({
      status: searchParams.get("status"),
      page: parseInt(searchParams.get("page") ?? "1"),
      limit: parseInt(searchParams.get("limit") ?? "50"),
    })

    if (!resultado.ok) {
      const { status, body } = apresentarErro(resultado.error)
      return NextResponse.json(body, { status })
    }

    return NextResponse.json(resultado.value)
  } catch (err) {
    const { status, body } = apresentarErro(err)
    if (status === 500) console.error("[GET /api/live]", err)
    return NextResponse.json(body, { status })
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const useCase = new CriarLiveUseCase(new LiveRepositorySupabase(createServerClient()))
    const resultado = await useCase.execute({
      titulo: body.titulo,
      dataLive: body.data_live,
      plataforma: body.plataforma,
      tipo: body.tipo,
      observacoes: body.observacoes,
      linkLive: body.link_live,
    })

    if (!resultado.ok) {
      const { status, body: erro } = apresentarErro(resultado.error)
      return NextResponse.json(erro, { status })
    }

    return NextResponse.json(resultado.value, { status: 201 })
  } catch (err) {
    const { status, body: erro } = apresentarErro(err)
    if (status === 500) console.error("[POST /api/live]", err)
    return NextResponse.json(erro, { status })
  }
})
