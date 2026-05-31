import { readFileSync } from "node:fs"
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
console.log("Banco verificado:", env.NEXT_PUBLIC_SUPABASE_URL)
const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
})
const defs = (await res.json()).definitions ?? {}
const has = (t, c) => defs[t]?.properties?.[c] ? "✅" : "❌ FALTA"
console.log("009 clientes.apelido            ", has("clientes","apelido"))
console.log("009 clientes.instagram          ", has("clientes","instagram"))
console.log("010 live_compras.link_pagamento ", has("live_compras","link_pagamento"))
console.log("010 live_compras.asaas_payment_id", has("live_compras","asaas_payment_id"))
console.log("010 live_compras.pagamento_status", has("live_compras","pagamento_status"))
console.log("011 trocas.cliente_nome         ", has("trocas","cliente_nome"))
console.log("011 trocas.produto_id           ", has("trocas","produto_id"))
console.log("011 trocas.resultado_fin        ", has("trocas","resultado_fin"))
console.log("012 live_compras.status_compra  ", has("live_compras","status_compra"))
console.log("012 live_compra_produtos (tabela)", defs["live_compra_produtos"] ? "✅" : "❌ FALTA")
