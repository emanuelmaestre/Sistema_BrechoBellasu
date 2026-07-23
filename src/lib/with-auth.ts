import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"

type AuthPayload = { id: number; perfil: string }
type AuthedHandler<Ctx> = (
  req: NextRequest,
  ctx: Ctx,
  auth: AuthPayload
) => Promise<NextResponse>

/**
 * Higher-order handler that eliminates the 51× manual verifyAuth boilerplate.
 *
 * Usage:
 *   export const GET = withAuth(async (req, ctx, auth) => {
 *     // auth.id and auth.perfil are guaranteed non-null here
 *   })
 */
export function withAuth<Ctx = unknown>(handler: AuthedHandler<Ctx>) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    const auth = verifyAuth(req)
    if (!auth) {
      return NextResponse.json(
        { erro: "Você precisa estar logado para realizar esta ação." },
        { status: 401 }
      )
    }
    return handler(req, ctx, auth)
  }
}
