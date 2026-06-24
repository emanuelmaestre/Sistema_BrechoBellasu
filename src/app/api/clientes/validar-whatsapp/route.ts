import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"

const limpaHeader = (s: string) => s.replace(/[^\x21-\x7E]/g, "")
const INSTANCE_ID  = () => limpaHeader(process.env.ZAPI_INSTANCE_ID  ?? "")
const TOKEN        = () => limpaHeader(process.env.ZAPI_TOKEN        ?? "")
const CLIENT_TOKEN = () => limpaHeader(process.env.ZAPI_CLIENT_TOKEN ?? "")
const BASE         = () => `https://api.z-api.io/instances/${INSTANCE_ID()}/token/${TOKEN()}`

export const dynamic = "force-dynamic"

export const POST = withAuth(async (req: NextRequest) => {
  const { celular } = await req.json().catch(() => ({})) as { celular?: string }
  if (!celular) return NextResponse.json({ valido: false, erro: "Número não informado." }, { status: 400 })

  const digits = celular.replace(/\D/g, "")
  const phone  = digits.startsWith("55") ? digits : `55${digits}`

  if (phone.length < 12 || phone.length > 13) {
    return NextResponse.json({ valido: false, erro: "Número fora do formato esperado." })
  }

  if (!INSTANCE_ID() || !TOKEN()) {
    return NextResponse.json({ valido: null, erro: "Z-API não configurada." })
  }

  try {
    const res = await fetch(`${BASE()}/phone-exists/${phone}`, {
      method: "GET",
      headers: { "Client-Token": CLIENT_TOKEN(), "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8_000),
    })

    if (!res.ok) return NextResponse.json({ valido: null, erro: "Não foi possível verificar." })

    const json = await res.json()
    // Z-API retorna { exists: true/false }
    const exists = json?.exists === true || json?.value?.exists === true
    return NextResponse.json({ valido: exists, phone })
  } catch {
    return NextResponse.json({ valido: null, erro: "Timeout ou falha de conexão." })
  }
})
