import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { testarConexao } from "@/lib/zapi"

export const dynamic = "force-dynamic"

// GET /api/configuracoes/zapi — Retorna info da instância Z-API
export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Você precisa estar logado para realizar esta ação." }, { status: 401 })

  const instanceId = process.env.ZAPI_INSTANCE_ID ?? ""
  const configurado = !!instanceId && !!process.env.ZAPI_TOKEN

  return NextResponse.json({
    configurado,
    instance_id: instanceId ? `${instanceId.substring(0, 8)}...` : "",
  })
}

// POST /api/configuracoes/zapi/testar — Testa conexão Z-API
export async function POST(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Você precisa estar logado para realizar esta ação." }, { status: 401 })

  const resultado = await testarConexao()
  return NextResponse.json(resultado)
}
