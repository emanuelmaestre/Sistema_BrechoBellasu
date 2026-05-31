import { readFileSync } from "node:fs"
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
console.log("Banco do .env.local:", url)
const h = { apikey: key, Authorization: `Bearer ${key}` }
// Conta e lista produtos
const prod = await fetch(`${url}/rest/v1/produtos?select=codigo,nome&order=codigo`, { headers: h })
const produtos = await prod.json()
console.log("\nProdutos neste banco:", Array.isArray(produtos) ? produtos.length : produtos)
if (Array.isArray(produtos)) console.log(produtos.map(p => `${p.codigo} ${p.nome}`).join(" | "))
// Conta clientes
const cli = await fetch(`${url}/rest/v1/clientes?select=id,nome`, { headers: h })
const clientes = await cli.json()
console.log("\nClientes neste banco:", Array.isArray(clientes) ? clientes.length : clientes)
if (Array.isArray(clientes)) console.log(clientes.map(c => c.nome).join(" | "))
