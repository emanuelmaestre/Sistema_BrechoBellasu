import { NextResponse } from "next/server"
import { google } from "googleapis"

// GET /api/google/auth — gera a URL de autorização OAuth (uso único, para obter refresh_token)
export async function GET() {
  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"
  const redirectUri  = `${appUrl}/api/google/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.json({ erro: "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados." }, { status: 500 })
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/contacts"],
  })

  return NextResponse.redirect(url)
}
