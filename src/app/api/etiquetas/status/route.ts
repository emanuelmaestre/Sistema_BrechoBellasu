import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { meUsuario } from "@/lib/melhorenvio"

// GET /api/etiquetas/status — verifica se o token está configurado e válido
export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

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
    const msg = err instanceof Error ? err.message : "Erro ao verificar token."
    return NextResponse.json({ configurado: false, env, mensagem: msg }, { status: 200 })
  }
}
