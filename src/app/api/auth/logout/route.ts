import { NextResponse } from "next/server"
import { AUTH_COOKIE } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Limpa o cookie HttpOnly de sessão. Necessário um endpoint porque o JS
// do browser não consegue apagar cookies HttpOnly.
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return res
}
