import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { randomBytes } from "node:crypto"
import { verifyAuth } from "@/lib/auth"

const GOOGLE_OAUTH_STATE_COOKIE = "google-oauth-state"

// Deriva a base URL a partir do host real da requisição (funciona em
// localhost e em produção sem depender de variável de ambiente).
function baseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? req.nextUrl.origin
}

// GET /api/google/auth — gera a URL de autorização OAuth (uso único, para obter refresh_token)
export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ erro: "Você precisa estar logado para conectar o Google." }, { status: 401 })
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri  = `${baseUrl(req)}/api/google/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.json({ erro: "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados." }, { status: 500 })
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  const state = randomBytes(32).toString("hex")

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/contacts"],
    login_hint: "bellasu.brecho@gmail.com",
    state,
  })

  const response = NextResponse.redirect(url)
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google",
    maxAge: 10 * 60,
  })
  return response
}
