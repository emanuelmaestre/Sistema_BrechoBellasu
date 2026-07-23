import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { calcularProximoCodigo } from "@/infrastructure/repositories/produto.repository"

export const dynamic = "force-dynamic"

// GET — prévia do código que o próximo produto cadastrado vai receber.
// Não reserva nada; o código real é calculado de novo no momento de salvar.
export const GET = withAuth(async () => {
  const sb = createServerClient()
  const codigo = await calcularProximoCodigo(sb)
  return NextResponse.json({ codigo })
})
