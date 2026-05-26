import { NextRequest, NextResponse } from "next/server"

const PUBLIC_ROUTES = ["/login"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas públicas — deixa passar
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // API routes — deixa passar (autenticação feita na rota)
  if (pathname.startsWith("/api")) {
    return NextResponse.next()
  }

  // Verifica token no cookie
  const token = request.cookies.get("brecho-token")?.value

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|LOGO.png).*)"],
}
