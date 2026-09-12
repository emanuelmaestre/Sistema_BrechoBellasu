// ══════════════════════════════════════════════════════════════════
// Redirect URI do OAuth do Google — fonte única da verdade.
//
// O Google exige que o redirect_uri enviado em /api/google/auth seja
// IDÊNTICO ao enviado em /api/google/callback, e que ambos estejam
// registrados no Google Cloud Console. Qualquer divergência resulta em
// "Erro 400: redirect_uri_mismatch".
//
// Por isso a derivação mora aqui, em um único lugar, em vez de estar
// duplicada nas duas rotas.
//
// Ordem de precedência:
//  1. NEXT_PUBLIC_APP_URL — domínio fixo, definido manualmente.
//  2. VERCEL_PROJECT_PRODUCTION_URL — domínio estável de produção da
//     Vercel. Usar isso (e não a origin da requisição) é essencial:
//     cada deploy da Vercel recebe uma URL única do tipo
//     brecho-bellasu-abc123.vercel.app, que nunca estará registrada
//     no Google e quebraria o OAuth a cada novo deploy.
//  3. A origin da requisição — só como último recurso (dev local).
// ══════════════════════════════════════════════════════════════════
import type { NextRequest } from "next/server"

export function googleRedirectBase(req: NextRequest): string {
  const explicito = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicito) return explicito.replace(/\/$/, "")

  const producaoVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (producaoVercel) return `https://${producaoVercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}`

  return req.nextUrl.origin
}

export function googleRedirectUri(req: NextRequest): string {
  return `${googleRedirectBase(req)}/api/google/callback`
}
