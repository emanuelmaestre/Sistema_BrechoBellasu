import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { meUsuario } from "@/lib/melhorenvio"

export const dynamic = "force-dynamic"

// GET /api/etiquetas/status — verifica se o token está configurado e válido
export const GET = withAuth(async (_req: NextRequest) => {
  const token = process.env.MELHOR_ENVIO_TOKEN
  const env   = process.env.MELHOR_ENVIO_ENV ?? "sandbox"

  if (!token) {
    return NextResponse.json({ configurado: false, env, mensagem: "Token não configurado." })
  }

  try {
    const usuario = await meUsuario()
    return NextResponse.json({
      configurado: true,
      env,
      usuario: { nome: `${usuario.firstname} ${usuario.lastname}`, email: usuario.email },
      cep_origem: process.env.MELHOR_ENVIO_CEP_ORIGEM ?? "não configurado",
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível verificar a conexão com o Melhor Envio. Verifique o token."
    return NextResponse.json({ configurado: false, env, mensagem: msg }, { status: 200 })
  }
})
