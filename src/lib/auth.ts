import { NextRequest } from "next/server"
import jwt from "jsonwebtoken"

interface JwtPayload {
  id: number
  perfil: string
}

export function verifyAuth(req: NextRequest): JwtPayload | null {
  try {
    const auth = req.headers.get("authorization") ?? ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!token) return null

    const secret = process.env.JWT_SECRET ?? "brecho-secret-dev"
    const payload = jwt.verify(token, secret) as JwtPayload
    return payload
  } catch {
    return null
  }
}
