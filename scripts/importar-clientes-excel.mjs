/**
 * IMPORTADOR DE CLIENTES — DISPARADOR.xlsx
 *
 * Lê o Excel, verifica duplicidade por CPF no Supabase,
 * cria novos cadastros e atualiza campos faltantes nos existentes.
 * Nunca apaga dados. Não envia WhatsApp (silent import).
 *
 * Uso: node scripts/importar-clientes-excel.mjs
 */

import { readFileSync } from "fs"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

// ── Config — lê do .env.local ou variáveis de ambiente ────────────────
function loadEnv() {
  try {
    const lines = readFileSync(".env.local", "utf-8").split("\n")
    for (const line of lines) {
      const m = line.match(/^([A-Z_]+)=(.+)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  } catch { /* arquivo pode não existir em CI */ }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidas.")
  process.exit(1)
}

const EXCEL_PATH = process.argv[2] || "C:/Users/Brechó Bellasu/Downloads/DISPARADOR.xlsx"

// ── Helpers ─────────────────────────────────────────────────────────────

/** Converte serial Excel para ISO date string (YYYY-MM-DD). */
function excelSerialToDate(serial) {
  if (!serial || typeof serial !== "number") return null
  // Excel usa 1900-01-01 = 1, com bug do leap year 1900
  const d = new Date((serial - 25569) * 86400 * 1000)
  return d.toISOString().split("T")[0]
}

/** Normaliza CPF: padeia com zeros à esquerda até 11 dígitos. */
function normalizarCpf(raw) {
  if (!raw || raw === 0) return null
  const digits = String(raw).replace(/\D/g, "").padStart(11, "0")
  if (digits.length !== 11) return null
  if (/^(\d)\1{10}$/.test(digits)) return null // todos iguais = inválido
  return digits
}

/** Valida CPF usando dígitos verificadores. */
function validarCpf(d) {
  if (!d || d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += Number(d[i]) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== Number(d[9])) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += Number(d[i]) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  return resto === Number(d[10])
}

/** Normaliza telefone: remove não-dígitos, remove prefixo 55 se tiver DD. */
function normalizarTelefone(raw) {
  if (!raw) return null
  let d = String(raw).replace(/\D/g, "")
  if (!d) return null
  // Remove prefixo internacional 55 se resultar em 11 dígitos (com DD)
  if (d.startsWith("55") && d.length >= 12) {
    const sem55 = d.slice(2)
    if (sem55.length >= 10 && sem55.length <= 11) d = sem55
  }
  // Deve ter 10 ou 11 dígitos
  if (d.length < 10 || d.length > 11) return d // mantém mesmo fora do padrão
  return d
}

/**
 * Extrai campos estruturados do endereço que vem em string única no Excel.
 * Formato: "LOGRADOURO, Nº 123 - COMPLEMENTO: xxx - BAIRRO: xxx - CIDADE: xxx - ESTADO: SP - CEP: 00000-000"
 */
function parseEndereco(addr) {
  if (!addr) return {}
  const s = String(addr).trim()
  const get = (pattern) => {
    const m = s.match(pattern)
    return m ? m[1].trim() : null
  }

  // CEP: 5 dígitos, traço, 3 dígitos
  let cep = null
  const cepM = s.match(/CEP:\s*(\d{5})-?(\d{3})/i)
  if (cepM) cep = `${cepM[1]}-${cepM[2]}`

  // ESTADO (2 letras após "ESTADO:")
  const estado = get(/ESTADO:\s*([A-Z]{2})/i)

  // CIDADE
  const cidade = get(/CIDADE:\s*([^-]+?)(?:\s*-\s*ESTADO|\s*-\s*CEP|$)/i)

  // BAIRRO
  const bairro = get(/BAIRRO:\s*([^-]+?)(?:\s*-\s*CIDADE|$)/i)

  // COMPLEMENTO
  const complemento = get(/COMPLEMENTO:\s*([^-]+?)(?:\s*-\s*BAIRRO|$)/i)

  // Número (depois de "Nº ")
  let numero = get(/Nº\s*([^-,\s][^-,]*?)(?:\s*-|\s*,|$)/i)
  // Sanitiza número: se for "CASA" ou similar, mantém; se for só número, mantém
  if (numero) numero = numero.trim()

  // Logradouro = tudo antes de ", Nº" ou " Nº"
  let logradouro = null
  const logM = s.match(/^([^,]+?)(?:,\s*Nº|\s+Nº)/i)
  if (logM) logradouro = logM[1].trim()

  // Capitaliza cidade (estava em maiúsculas no Excel)
  const capitalize = (str) => {
    if (!str) return null
    return str
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
  }

  return {
    cep: cep || null,
    estado: estado ? estado.toUpperCase() : null,
    cidade: capitalize(cidade),
    bairro: capitalize(bairro),
    complemento: complemento ? capitalize(complemento) : null,
    numero: numero || null,
    logradouro: logradouro ? capitalize(logradouro) : null,
  }
}

/** Capitaliza nome (tudo maiúsculo no Excel). */
function capitalizarNome(nome) {
  if (!nome) return ""
  const excepcoes = new Set([
    "de", "da", "do", "das", "dos", "e", "em", "na", "no",
    "nas", "nos", "a", "o", "as", "os", "com", "por", "para",
  ])
  return String(nome)
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i === 0 || !excepcoes.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(" ")
}

// ── Supabase REST ─────────────────────────────────────────────────────

async function supabaseGet(path, params = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  })
  if (!res.ok) throw new Error(`GET ${path}: HTTP ${res.status} — ${await res.text()}`)
  return res.json()
}

async function supabaseInsert(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`INSERT ${table}: HTTP ${res.status} — ${text}`)
  return JSON.parse(text)
}

async function supabasePatch(table, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`PATCH ${table}[${id}]: HTTP ${res.status} — ${text}`)
  return JSON.parse(text)
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗")
  console.log("║  IMPORTADOR DE CLIENTES — DISPARADOR.xlsx             ║")
  console.log("╚══════════════════════════════════════════════════════╝\n")

  // 1. Ler Excel
  const wb = XLSX.readFile(EXCEL_PATH)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1 })

  // Filtra linhas com nome
  const rows = raw.filter((r, i) => i > 0 && r[0] && String(r[0]).trim())
  console.log(`📊 Total de linhas com nome no Excel: ${rows.length}`)

  // 2. Processar cada linha
  const clientes = []
  const pendencias = []
  const cpfsVistos = new Set() // para detectar duplicatas no próprio Excel

  for (const [idx, row] of rows.entries()) {
    const nomeRaw = String(row[0] || "").trim()
    const enderecoRaw = row[1]
    const telefoneRaw = row[2]
    const cpfRaw = row[3]
    const dataNascRaw = row[4]
    const instagramRaw = row[5]

    const nome = capitalizarNome(nomeRaw)
    const cpf = normalizarCpf(cpfRaw)
    const telefone = normalizarTelefone(telefoneRaw)
    const dataNasc = excelSerialToDate(dataNascRaw)
    const instagram = instagramRaw ? String(instagramRaw).trim().toLowerCase() : null
    const endereco = parseEndereco(enderecoRaw)

    // Validações
    if (!cpf) {
      pendencias.push({ linha: idx + 2, nome, motivo: `CPF inválido ou ausente (valor: ${cpfRaw})` })
      continue
    }

    if (!validarCpf(cpf)) {
      pendencias.push({ linha: idx + 2, nome, motivo: `CPF com dígito verificador inválido: ${cpf}` })
      continue
    }

    // Duplicata no Excel
    if (cpfsVistos.has(cpf)) {
      pendencias.push({ linha: idx + 2, nome, motivo: `CPF duplicado no Excel (${cpf}), já processada uma ocorrência` })
      continue
    }
    cpfsVistos.add(cpf)

    clientes.push({ nome, cpf, telefone, dataNasc, instagram, ...endereco })
  }

  console.log(`✅ Clientes válidos para processar: ${clientes.length}`)
  console.log(`⚠️  Pendências encontradas: ${pendencias.length}\n`)

  // 3. Buscar todos os CPFs existentes no banco de uma vez
  console.log("🔍 Consultando CPFs existentes no banco...")
  const cpfsDoExcel = clientes.map((c) => c.cpf)
  const existentes = await supabaseGet("clientes", {
    select: "id,nome,cpf_cnpj,celular,instagram,data_nasc,logradouro,numero,complemento,bairro,cidade,estado,cep",
    cpf_cnpj: `in.(${cpfsDoExcel.join(",")})`,
  })
  const mapCpfParaCliente = new Map(existentes.map((c) => [c.cpf_cnpj, c]))
  console.log(`   → ${existentes.length} CPFs já existem no sistema\n`)

  // 4. Processar cada cliente
  const resultados = { criados: 0, atualizados: 0, semAlteracao: 0 }
  const log = []

  for (const c of clientes) {
    const existente = mapCpfParaCliente.get(c.cpf)

    if (existente) {
      // CPF já existe — verificar se há campos faltantes para atualizar
      const atualizacoes = {}

      // Atualiza apenas campos vazios/nulos no cadastro existente
      if (!existente.celular && c.telefone) atualizacoes.celular = c.telefone
      if (!existente.instagram && c.instagram && c.instagram !== "@") atualizacoes.instagram = c.instagram
      if (!existente.data_nasc && c.dataNasc) atualizacoes.data_nasc = c.dataNasc
      if (!existente.logradouro && c.logradouro) atualizacoes.logradouro = c.logradouro
      if (!existente.numero && c.numero) atualizacoes.numero = c.numero
      if (!existente.complemento && c.complemento) atualizacoes.complemento = c.complemento
      if (!existente.bairro && c.bairro) atualizacoes.bairro = c.bairro
      if (!existente.cidade && c.cidade) atualizacoes.cidade = c.cidade
      if (!existente.estado && c.estado) atualizacoes.estado = c.estado
      if (!existente.cep && c.cep) atualizacoes.cep = c.cep

      if (Object.keys(atualizacoes).length > 0) {
        await supabasePatch("clientes", existente.id, atualizacoes)
        resultados.atualizados++
        log.push(`🔄 ATUALIZADO  [ID ${existente.id}] ${existente.nome} — campos: ${Object.keys(atualizacoes).join(", ")}`)
      } else {
        resultados.semAlteracao++
        log.push(`⏭️  SEM MUDANÇA [ID ${existente.id}] ${existente.nome} (CPF ${c.cpf})`)
      }
    } else {
      // CPF não existe — criar novo cliente
      const payload = {
        nome: c.nome,
        cpf_cnpj: c.cpf,
        celular: c.telefone,
        instagram: c.instagram && c.instagram !== "@" ? c.instagram : null,
        data_nasc: c.dataNasc,
        logradouro: c.logradouro,
        numero: c.numero,
        complemento: c.complemento,
        bairro: c.bairro,
        cidade: c.cidade,
        estado: c.estado,
        cep: c.cep,
        ativo: true,
        notificacao_status: "pendente",
      }

      // Remove chaves null para não sobrescrever defaults do banco
      for (const k of Object.keys(payload)) {
        if (payload[k] === null || payload[k] === undefined) delete payload[k]
      }

      const [inserido] = await supabaseInsert("clientes", payload)
      resultados.criados++
      log.push(`✅ CRIADO      [ID ${inserido.id}] ${c.nome} (CPF ${c.cpf})`)
    }
  }

  // 5. Relatório final
  console.log("─".repeat(60))
  log.forEach((l) => console.log(l))
  console.log("─".repeat(60))
  console.log(`\n📋 RESUMO FINAL:`)
  console.log(`   ✅ Criados:        ${resultados.criados}`)
  console.log(`   🔄 Atualizados:    ${resultados.atualizados}`)
  console.log(`   ⏭️  Sem alteração:  ${resultados.semAlteracao}`)

  if (pendencias.length > 0) {
    console.log(`\n⚠️  PENDÊNCIAS (verificação manual necessária):`)
    pendencias.forEach((p) => {
      console.log(`   Linha ${p.linha}: ${p.nome} — ${p.motivo}`)
    })
  }

  console.log("\n✔️  Importação concluída.")
}

main().catch((err) => {
  console.error("\n❌ Erro fatal:", err.message)
  process.exit(1)
})
