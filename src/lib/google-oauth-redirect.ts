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
//  1. APP_URL — domínio fixo, lido em tempo de execução. Preferir esta a
//     NEXT_PUBLIC_APP_URL: variáveis NEXT_PUBLIC_* são embutidas no
//     bundle durante o build, então alterá-las no painel da Vercel não
//     tem efeito enquanto não houver um build novo (um redeploy que
//     reaproveita o cache mantém o valor antigo). APP_URL é lida a cada
//     requisição e passa a valer assim que a variável muda.
//  2. VERCEL_PROJECT_PRODUCTION_URL — domínio estável de produção da
//     Vercel, injetado automaticamente. Usar isso (e não a origin da
//     requisição) é essencial: cada deploy recebe uma URL única do tipo
//     brecho-bellasu-abc123.vercel.app, que nunca estará registrada no
//     Google e quebraria o OAuth a cada nova publicação.
//  3. NEXT_PUBLIC_APP_URL — compatibilidade com a configuração antiga.
//  4. A origin da requisição — último recurso (dev local).
//
// Em qualquer caso, um valor apontando para localhost é descartado fora
// de desenvolvimento: o Google recusaria com redirect_uri_mismatch, e o
// engano é fácil de cometer copiando o .env.local para o painel.
// ══════════════════════════════════════════════════════════════════
import type { NextRequest } from "next/server"

const ehLocal = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url)

function normaliza(url: string | undefined): string | null {
  const limpo = url?.trim().replace(/\/$/, "")
  if (!limpo) return null
  const comEsquema = /^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`
  // Em produção, um localhost herdado do .env.local nunca serve.
  if (ehLocal(comEsquema) && process.env.NODE_ENV === "production") return null
  return comEsquema
}

export function googleRedirectBase(req: NextRequest): string {
  return normaliza(process.env.APP_URL)
    ?? normaliza(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    ?? normaliza(process.env.NEXT_PUBLIC_APP_URL)
    ?? req.nextUrl.origin
}

export function googleRedirectUri(req: NextRequest): string {
  return `${googleRedirectBase(req)}/api/google/callback`
}
