import { createServerClient } from "./supabase"

const CHAVE = "google_refresh_token"

/**
 * Token salvo no Supabase (tabela `configuracoes`) para sobreviver a deploys sem
 * intervenção manual. GOOGLE_REFRESH_TOKEN (env var) é só fallback de migração —
 * uma vez reconectado pela tela de Configurações, o token passa a vir do banco.
 */
export async function obterGoogleRefreshToken(): Promise<string | null> {
  const sb = createServerClient()
  const { data } = await sb.from("configuracoes").select("valor").eq("chave", CHAVE).maybeSingle()
  const doBanco = (data?.valor as { refresh_token?: string } | null)?.refresh_token
  return doBanco || process.env.GOOGLE_REFRESH_TOKEN || null
}

export async function salvarGoogleRefreshToken(refreshToken: string): Promise<void> {
  const sb = createServerClient()
  const { error } = await sb.from("configuracoes")
    .upsert({ chave: CHAVE, valor: { refresh_token: refreshToken, atualizado_em: new Date().toISOString() } }, { onConflict: "chave" })
  if (error) throw new Error(`Não foi possível salvar o token do Google: ${error.message}`)
}
