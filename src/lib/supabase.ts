import { createClient } from "@supabase/supabase-js"

// Supabase server-side (service role) — usado nas Route Handlers / Server.
// Todo acesso ao banco passa por aqui; não há cliente anon no browser.
export function createServerClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) throw new Error("Supabase env vars not set (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)")
  return createClient(url, service)
}
