import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { randomBytes } from "node:crypto"
import { withAdminAuth } from "@/lib/with-auth"
import { googleRedirectUri } from "@/lib/google-oauth-redirect"

const GOOGLE_OAUTH_STATE_COOKIE = "google-oauth-state"

// GET /api/google/auth — gera a URL de autorização OAuth (uso único, para obter refresh_token)
// ?redirect_uri=1 — não redireciona; só mostra qual redirect_uri será usado,
//                   para conferir com o que está registrado no Google Cloud Console.
export const GET = withAdminAuth(async (req: NextRequest) => {
  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri  = googleRedirectUri(req)

  if (req.nextUrl.searchParams.has("redirect_uri")) {
    return NextResponse.json({ redirect_uri: redirectUri })
  }

  if (!clientId || !clientSecret) {
    return NextResponse.json({ erro: "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados." }, { status: 500 })
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  const state = randomBytes(32).toString("hex")

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    // "select_account" força a tela de escolha de conta mesmo quando há
    // várias sessões Google abertas no navegador — sem isso o Google
    // assume sozinho a conta ativa e conecta o Contatos errado.
    // "consent" continua obrigatório para o refresh_token vir de volta.
    prompt: "select_account consent",
    scope: ["https://www.googleapis.com/auth/contacts"],
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
})
