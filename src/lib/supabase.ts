import { createClient } from "@supabase/supabase-js"

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client-side Supabase (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnon)

// Server-side Supabase (service role — apenas em Server Components / Route Handlers)
export function createServerClient() {
  return createClient(supabaseUrl, supabaseService)
}
