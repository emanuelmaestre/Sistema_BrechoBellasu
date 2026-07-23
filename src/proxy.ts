import { NextRequest, NextResponse } from "next/server"
import routingData from "@/data/config/routing.json"

const PUBLIC_ROUTES = routingData.publicRoutes


export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas públicas — deixa passar
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // API routes — deixa passar (autenticação feita na rota)
  if (pathname.startsWith("/api")) {
    return NextResponse.next()
  }

  // Verifica presença do cookie de sessão (gate otimista)
  const token = request.cookies.get("brecho-token")?.value

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|LOGO.png).*)"],
}
