import { NextResponse } from "next/server"

function unauthorized(message = "Nao autorizado.") {
  return NextResponse.json({ erro: message }, { status: 401 })
}

function missingConfig(name: string) {
  console.error(`[security] ${name} nao configurado`)
  return NextResponse.json({ erro: "Erro de configuracao do servidor." }, { status: 500 })
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? ""
  return auth.startsWith("Bearer ") ? auth.slice(7) : null
}

export function requireCronAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return missingConfig("CRON_SECRET")

  const token = bearerToken(req)
  const headerSecret = req.headers.get("x-cron-secret")
  if (token !== secret && headerSecret !== secret) return unauthorized()

  return null
}

export function requireZapiWebhookAuth(req: Request): NextResponse | null {
  const secret = process.env.ZAPI_WEBHOOK_SECRET?.trim()
  if (!secret) return missingConfig("ZAPI_WEBHOOK_SECRET")

  const token = bearerToken(req)
  const headerSecret = req.headers.get("x-zapi-webhook-secret")
  if (token !== secret && headerSecret !== secret) return unauthorized()

  return null
}
