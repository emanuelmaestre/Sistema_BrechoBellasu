import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { testarConexao } from "@/lib/zapi"

export const dynamic = "force-dynamic"

// GET /api/configuracoes/zapi — Retorna info da instância Z-API
export const GET = withAuth(async (_req: NextRequest) => {
  const instanceId = process.env.ZAPI_INSTANCE_ID ?? ""
  const configurado = !!instanceId && !!process.env.ZAPI_TOKEN

  return NextResponse.json({
    configurado,
    instance_id: instanceId ? `${instanceId.substring(0, 8)}...` : "",
  })
})

// POST /api/configuracoes/zapi/testar — Testa conexão Z-API
export const POST = withAuth(async (_req: NextRequest) => {
  const resultado = await testarConexao()
  return NextResponse.json(resultado)
})
