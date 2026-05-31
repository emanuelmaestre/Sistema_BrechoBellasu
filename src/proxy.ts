import { NextRequest, NextResponse } from "next/server"

// Next.js 16: "middleware" passou a se chamar "proxy" (arquivo proxy.ts,
// função `proxy`). Mesma função: gate otimista de rotas antes da request.
// A autorização real é feita em cada route handler via verifyAuth().

const PUBLIC_ROUTES = ["/login"]

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
