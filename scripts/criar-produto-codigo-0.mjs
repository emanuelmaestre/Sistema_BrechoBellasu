/**
 * Cria o produto de código "0" (nome "produto") com estoque ILIMITADO
 * (controlar_estoque = false). Idempotente: se já existir código "0",
 * não duplica — apenas informa.
 *
 * Uso: node scripts/criar-produto-codigo-0.mjs
 */
import { readFileSync } from "fs"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const { createClient } = require("@supabase/supabase-js")

function loadEnv() {
  try {
    const lines = readFileSync(".env.local", "utf-8").split("\n")
    for (const line of lines) {
      const m = line.match(/^([A-Z_]+)=(.+)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  } catch { /* pode não existir */ }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Variáveis do Supabase não definidas.")
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const run = async () => {
  // 1) Já existe produto com código "0"?
  const { data: existente, error: erroBusca } = await sb
    .from("produtos")
    .select("id, codigo, nome, controlar_estoque, estoque_atual")
    .eq("codigo", "0")
    .maybeSingle()

  if (erroBusca) {
    console.error("❌ Erro ao verificar existência:", erroBusca.message)
    process.exit(1)
  }
  if (existente) {
    console.log("ℹ️  Já existe um produto com código 0 — nada foi criado:")
    console.log(JSON.stringify(existente, null, 2))
    return
  }

  // 2) Cria
  const { data, error } = await sb
    .from("produtos")
    .insert({
      nome: "produto",
      codigo: "0",
      categoria_id: null,
      marca: null,
      preco_venda: 0,
      preco_custo: 0,
      estoque_atual: 0,
      controlar_estoque: false, // ILIMITADO
      unidade_medida: "pc",
      cor: null,
      tamanho: null,
    })
    .select("id, codigo, nome, controlar_estoque, estoque_atual")
    .single()

  if (error) {
    console.error("❌ Erro ao criar:", error.code, error.message)
    process.exit(1)
  }
  console.log("✅ Produto criado:")
  console.log(JSON.stringify(data, null, 2))
}

run()
