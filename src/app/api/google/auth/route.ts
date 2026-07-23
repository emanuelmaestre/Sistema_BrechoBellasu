import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

// Deriva a base URL a partir do host real da requisição (funciona em
// localhost e em produção sem depender de variável de ambiente).
function baseUrl(req: NextRequest): string {
  const host  = req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https")
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"
}

// GET /api/google/auth — gera a URL de autorização OAuth (uso único, para obter refresh_token)
export async function GET(req: NextRequest) {
  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri  = `${baseUrl(req)}/api/google/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.json({ erro: "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados." }, { status: 500 })
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/contacts"],
    login_hint: "bellasu.brecho@gmail.com",
  })

  return NextResponse.redirect(url)
}
