import { createClient } from "@supabase/supabase-js"

// Client-side Supabase (anon key) — lazy singleton
let _client: ReturnType<typeof createClient> | null = null
export function getSupabaseClient() {
  if (!_client) {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) throw new Error("Supabase env vars not set (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)")
    _client = createClient(url, anon)
  }
  return _client
}

// Server-side Supabase (service role — apenas em Server Components / Route Handlers)
export function createServerClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) throw new Error("Supabase env vars not set (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)")
  return createClient(url, service)
}

// Compatibilidade: export nomeado `supabase` para código legado
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
