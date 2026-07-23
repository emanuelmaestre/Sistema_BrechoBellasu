import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { createServerClient } from "@/lib/supabase"
import { normAddr, parseBusca, ordenarSugestoes, type EnderecoSugestao } from "@/lib/endereco-parser"
import { buscarPorCep, buscarPorTexto } from "@/lib/enderecos-provider"

export const dynamic = "force-dynamic"

/** Endereços mudam muito pouco — um mês de cache é conservador. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

interface CacheRow { chave: string; resultado: EnderecoSugestao[]; updated_at: string }

async function lerCache(chave: string): Promise<EnderecoSugestao[] | null> {
  try {
    const sb = createServerClient()
    const { data } = await sb
      .from("enderecos_cache")
      .select("chave, resultado, updated_at")
      .eq("chave", chave)
      .maybeSingle<CacheRow>()

    if (!data) return null
    if (Date.now() - new Date(data.updated_at).getTime() > CACHE_TTL_MS) return null

    // Contabiliza o reuso sem segurar a resposta.
    sb.rpc("registrar_hit_endereco_cache", { p_chave: chave }).then(() => {}, () => {})
    return data.resultado
  } catch {
    return null
  }
}

async function gravarCache(chave: string, resultado: EnderecoSugestao[]): Promise<void> {
  if (resultado.length === 0) return // não vale cachear "não achei"
  try {
    const sb = createServerClient()
    await sb.from("enderecos_cache").upsert(
      { chave, resultado, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
  } catch { /* cache é otimização, nunca derruba a busca */ }
}

interface CadastroRow {
  cep: string | null; logradouro: string; bairro: string
  cidade: string; estado: string; ocorrencias: number
}

/**
 * Fonte mais rápida e confiável: os endereços que já estão no cadastro.
 * As clientes do brechó se repetem muito por bairro, então boa parte das
 * buscas termina aqui — sem tocar em nenhuma API externa.
 */
async function buscarNoCadastro(tokens: string[]): Promise<EnderecoSugestao[]> {
  if (tokens.length === 0) return []
  try {
    const sb = createServerClient()
    const { data, error } = await sb.rpc("buscar_enderecos_cadastrados", {
      p_tokens: tokens,
      p_limite: 6,
    })
    if (error || !Array.isArray(data)) return []

    return (data as CadastroRow[]).map(r => ({
      cep:         r.cep ?? "",
      logradouro:  r.logradouro,
      bairro:      r.bairro,
      cidade:      r.cidade,
      estado:      r.estado,
      fonte:       "cadastro" as const,
      ocorrencias: Number(r.ocorrencias ?? 0),
    }))
  } catch {
    return []
  }
}

// GET /api/enderecos/buscar?q=... — autocomplete de endereço
export const GET = withAuth(async (req: NextRequest) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim()
  if (q.length < 3) {
    return NextResponse.json({ sugestoes: [], numero: "", complemento: "" })
  }

  const busca = parseBusca(q)
  const chave = `v1:${normAddr(q)}`

  // ── Caminho curto: CEP completo ──────────────────────────────
  if (busca.cep) {
    const cacheado = await lerCache(chave)
    if (cacheado) {
      return NextResponse.json({ sugestoes: cacheado, numero: "", complemento: "", cache: true })
    }
    const sugestoes = await buscarPorCep(busca.cep)
    await gravarCache(chave, sugestoes)
    return NextResponse.json({ sugestoes, numero: "", complemento: "", cache: false })
  }

  if (busca.ruaSemPrefixo.length < 3) {
    return NextResponse.json({ sugestoes: [], numero: busca.numero, complemento: busca.complemento })
  }

  // ── Cadastro e cache não dependem um do outro ────────────────
  const [doCadastro, cacheado] = await Promise.all([
    buscarNoCadastro(busca.tokens),
    lerCache(chave),
  ])

  let externas: EnderecoSugestao[]
  if (cacheado) {
    externas = cacheado
  } else {
    externas = await buscarPorTexto(busca)
    await gravarCache(chave, externas)
  }

  const sugestoes = ordenarSugestoes([...doCadastro, ...externas], busca).slice(0, 8)

  return NextResponse.json({
    sugestoes,
    numero:      busca.numero,
    complemento: busca.complemento,
    cache:       !!cacheado,
  })
})
