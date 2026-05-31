import { NextRequest } from "next/server"
import jwt from "jsonwebtoken"

interface JwtPayload {
  id: number
  perfil: string
}

/** Nome do cookie de sessão (HttpOnly). Compartilhado com o login/logout/proxy. */
export const AUTH_COOKIE = "brecho-token"

export function verifyAuth(req: NextRequest): JwtPayload | null {
  try {
    // Preferência: cookie HttpOnly (não acessível via JS → resistente a XSS).
    // Fallback: header Bearer (compatibilidade durante a transição).
    const cookieToken = req.cookies.get(AUTH_COOKIE)?.value
    const authHeader = req.headers.get("authorization") ?? ""
    const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    const token = cookieToken || headerToken
    if (!token) return null

    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error("[auth] JWT_SECRET não configurado")
      return null
    }
    return jwt.verify(token, secret) as JwtPayload
  } catch {
    return null
  }
}
