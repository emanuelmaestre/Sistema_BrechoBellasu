import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

// Deriva a base URL a partir do host real da requisição — deve bater
// exatamente com o redirect_uri usado em /api/google/auth.
function baseUrl(req: NextRequest): string {
  const host  = req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https")
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"
}

// GET /api/google/callback — captura o refresh_token após autorização OAuth
export async function GET(req: NextRequest) {
  const code         = req.nextUrl.searchParams.get("code")
  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri  = `${baseUrl(req)}/api/google/callback`

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
    return new NextResponse(`Falha ao trocar o código por token: ${msg}`, { status: 400 })
  }

  if (!refreshToken) {
    return new NextResponse(
      "Refresh token não retornado. Revogue o acesso em myaccount.google.com/permissions e tente novamente.",
      { status: 400 }
    )
  }

  // Exibe o token para o operador copiar — nunca é logado em produção
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Google OAuth — Brechó Bellasu</title>
    <style>body{font-family:monospace;background:#111;color:#eee;padding:2rem}
    .box{background:#1e1e1e;border:1px solid #444;border-radius:8px;padding:1.5rem;margin-top:1rem}
    .token{word-break:break-all;color:#4ade80;font-size:0.9rem}
    h2{color:#facc15}p{color:#aaa}</style></head><body>
    <h2>✅ Autorização concluída!</h2>
    <p>Copie o token abaixo e salve como <code>GOOGLE_REFRESH_TOKEN</code> no <code>.env.local</code> e nas variáveis do Vercel:</p>
    <div class="box"><div class="token">${refreshToken}</div></div>
    <p style="margin-top:1.5rem;color:#f87171">⚠️ Não compartilhe este token. Feche esta aba após copiar.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  )
}
