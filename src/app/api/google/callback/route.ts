import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { timingSafeEqual } from "node:crypto"
import { withAdminAuth } from "@/lib/with-auth"
import { googleRedirectUri } from "@/lib/google-oauth-redirect"
import { salvarGoogleRefreshToken } from "@/lib/google-refresh-token"

const GOOGLE_OAUTH_STATE_COOKIE = "google-oauth-state"

function stateValido(recebido: string | null, esperado: string | undefined): boolean {
  if (!recebido || !esperado) return false
  const recebidoBuffer = Buffer.from(recebido)
  const esperadoBuffer = Buffer.from(esperado)
  return recebidoBuffer.length === esperadoBuffer.length &&
    timingSafeEqual(recebidoBuffer, esperadoBuffer)
}

// GET /api/google/callback — captura o refresh_token após autorização OAuth
export const GET = withAdminAuth(async (req: NextRequest) => {
  const code         = req.nextUrl.searchParams.get("code")
  const state        = req.nextUrl.searchParams.get("state")
  const expectedState = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value
  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri  = googleRedirectUri(req)

  if (!stateValido(state, expectedState)) {
    return new NextResponse("Estado OAuth inválido ou expirado. Inicie a conexão novamente.", { status: 400 })
  }
  if (!code) {
    return new NextResponse("Autorização negada ou código ausente.", { status: 400 })
  }
  if (!clientId || !clientSecret) {
    return new NextResponse("Credenciais Google não configuradas.", { status: 500 })
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  let refreshToken: string | null | undefined
  try {
    const { tokens } = await oauth2.getToken(code)
    refreshToken = tokens.refresh_token
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new NextResponse(
      `Falha ao trocar o código por token: ${msg}\n\n` +
      `redirect_uri usado: ${redirectUri}\n` +
      `Se o erro for redirect_uri_mismatch, registre exatamente essa URL em ` +
      `"URIs de redirecionamento autorizados" no Google Cloud Console.`,
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    )
  }

  if (!refreshToken) {
    return new NextResponse(
      "Refresh token não retornado. Revogue o acesso em myaccount.google.com/permissions e tente novamente.",
      { status: 400 }
    )
  }

  try {
    await salvarGoogleRefreshToken(refreshToken)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new NextResponse(`Autorização recebida, mas falhou ao salvar: ${msg}`, { status: 500 })
  }

  // Token já salvo no banco — a aba só confirma e fecha sozinha, sem passo manual.
  const response = new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Google OAuth — Brechó Bellasu</title>
    <style>body{font-family:system-ui,sans-serif;background:#111;color:#eee;padding:2rem;text-align:center}
    h2{color:#4ade80}p{color:#aaa}</style></head><body>
    <h2>✅ Google reconectado!</h2>
    <p>O token já foi salvo automaticamente. Esta aba fecha sozinha em instantes.</p>
    <script>setTimeout(() => { window.close(); if (window.opener) window.opener.location.reload() }, 1500)</script>
    </body></html>`,
    { headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    } }
  )
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google",
    maxAge: 0,
  })
  return response
})
