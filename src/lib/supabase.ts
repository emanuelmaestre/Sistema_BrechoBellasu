import { createClient } from "@supabase/supabase-js"

function readEnv(name: string): string | undefined {
  return process.env[name]?.replace(/^\uFEFF/, "").trim()
}

export function createServerClient() {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL")
  const service = readEnv("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !service) {
    throw new Error("Supabase env vars not set (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)")
  }
  return createClient(url, service, { auth: { persistSession: false } })
}
