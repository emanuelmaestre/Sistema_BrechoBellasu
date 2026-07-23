// ══════════════════════════════════════════════════════════════════
// Provedores externos de endereço — executam SOMENTE no servidor.
//
// Rodar no servidor resolve três coisas que quebravam na versão antiga:
//  • o `User-Agent` exigido pelas APIs realmente é enviado (o browser
//    ignora esse header e ainda transforma a chamada em preflight CORS);
//  • dá para paralelizar e cachear;
//  • trocar de provedor não exige mexer na tela.
//
// Nenhum provedor derruba a busca: falha vira lista vazia.
// ══════════════════════════════════════════════════════════════════
import {
  ESTADO_SIGLA, LOJA_COORD, faixaContemNumero,
  type BuscaParseada, type EnderecoSugestao,
} from "./endereco-parser"

const USER_AGENT = "Brecho Bellasu (bellasu.brecho@gmail.com)"
const TIMEOUT_MS = 6000

// Caixa de Brasília: limita o Photon ao território brasileiro
// (o serviço não tem filtro por país, mas aceita bounding box).
const BBOX_BRASIL = "-73.99,-33.75,-28.85,5.27"

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function formatarCep(digitos: string): string {
  const d = (digitos ?? "").replace(/\D/g, "")
  return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, "$1-$2") : ""
}

// ── ViaCEP ───────────────────────────────────────────────────────

interface ViaCepItem {
  cep?: string; logradouro?: string; complemento?: string
  bairro?: string; localidade?: string; uf?: string; erro?: boolean | string
}

/** Busca por CEP exato. */
export async function viacepPorCep(cep: string): Promise<EnderecoSugestao | null> {
  const limpo = cep.replace(/\D/g, "")
  if (limpo.length !== 8) return null

  const d = await fetchJson<ViaCepItem>(`https://viacep.com.br/ws/${limpo}/json/`)
  if (!d || d.erro) return null

  return {
    cep:        formatarCep(limpo),
    logradouro: d.logradouro ?? "",
    bairro:     d.bairro     ?? "",
    cidade:     d.localidade ?? "",
    estado:     d.uf         ?? "",
    fonte:      "viacep",
  }
}

/**
 * Busca por nome de rua dentro de uma cidade.
 *
 * Quando a rua tem vários CEPs (avenidas longas), o ViaCEP devolve a
 * faixa numérica em `complemento`. Se a pessoa digitou o número, usamos
 * essa faixa para descartar os CEPs que não servem — antes o sistema
 * simplesmente pegava o primeiro da lista e podia gravar o CEP errado.
 */
export async function viacepPorRua(
  uf: string,
  cidade: string,
  rua: string,
  numero?: string,
): Promise<EnderecoSugestao[]> {
  if (rua.trim().length < 3) return []

  const url = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`
  const items = await fetchJson<ViaCepItem[]>(url)
  if (!Array.isArray(items)) return []

  const mapeados = items.slice(0, 10).map(it => ({
    sugestao: {
      cep:        formatarCep(it.cep ?? ""),
      logradouro: it.logradouro ?? "",
      bairro:     it.bairro     ?? "",
      cidade:     it.localidade ?? "",
      estado:     it.uf         ?? "",
      fonte:      "viacep" as const,
    },
    naFaixa: numero ? faixaContemNumero(it.complemento, numero) : null,
  }))

  // Se algum CEP casa com o número digitado, os que sabidamente NÃO
  // casam são descartados. Faixas indecifráveis (null) permanecem.
  const temCerteiro = mapeados.some(m => m.naFaixa === true)
  const filtrados = temCerteiro ? mapeados.filter(m => m.naFaixa !== false) : mapeados

  return filtrados.map(m => m.sugestao)
}

// ── BrasilAPI (fallback de CEP) ──────────────────────────────────

interface BrasilApiCep {
  cep?: string; state?: string; city?: string
  neighborhood?: string; street?: string
}

/**
 * Fallback quando o ViaCEP está fora do ar ou não conhece o CEP.
 * A BrasilAPI agrega ViaCEP + Correios + WideNet, então costuma
 * responder mesmo quando uma das fontes falha.
 */
export async function brasilapiPorCep(cep: string): Promise<EnderecoSugestao | null> {
  const limpo = cep.replace(/\D/g, "")
  if (limpo.length !== 8) return null

  const d = await fetchJson<BrasilApiCep>(`https://brasilapi.com.br/api/cep/v2/${limpo}`)
  if (!d?.city) return null

  return {
    cep:        formatarCep(limpo),
    logradouro: d.street       ?? "",
    bairro:     d.neighborhood ?? "",
    cidade:     d.city         ?? "",
    estado:     d.state        ?? "",
    fonte:      "brasilapi",
  }
}

// ── Photon (autocomplete) ────────────────────────────────────────

interface PhotonFeature {
  properties?: {
    name?: string; street?: string; housenumber?: string
    district?: string; city?: string; county?: string; locality?: string
    state?: string; postcode?: string; countrycode?: string; type?: string
  }
}

/**
 * Substitui o Nominatim, que a política de uso desaconselha para
 * autocomplete e limita a ~1 req/s. O Photon usa a mesma base OSM mas
 * foi construído justamente para busca conforme se digita.
 *
 * `lat`/`lon` aplicam viés geográfico: resultados perto da loja sobem
 * naturalmente, sem precisar do bônus fixo de Ribeirão Preto que
 * atrapalhava clientes de outras cidades.
 */
export async function photonBusca(query: string, limite = 8): Promise<EnderecoSugestao[]> {
  if (query.trim().length < 3) return []

  const params = new URLSearchParams({
    q:     query,
    limit: String(limite),
    lat:   String(LOJA_COORD.lat),
    lon:   String(LOJA_COORD.lon),
    bbox:  BBOX_BRASIL,
  })

  const data = await fetchJson<{ features?: PhotonFeature[] }>(
    `https://photon.komoot.io/api/?${params.toString()}`
  )
  if (!Array.isArray(data?.features)) return []

  const out: EnderecoSugestao[] = []
  for (const f of data.features) {
    const p = f.properties ?? {}
    if (p.countrycode && p.countrycode !== "BR") continue

    const logradouro = p.street ?? p.name ?? ""
    if (!logradouro) continue

    out.push({
      cep:        formatarCep(p.postcode ?? ""),
      logradouro,
      bairro:     p.district ?? p.locality ?? "",
      cidade:     p.city ?? p.county ?? "",
      estado:     ESTADO_SIGLA[p.state ?? ""] ?? "",
      fonte:      "photon",
      numero:     p.housenumber,
    })
  }
  return out
}

// ── Orquestração ─────────────────────────────────────────────────

/**
 * Completa o CEP das sugestões que vieram sem ele.
 *
 * A versão antiga fazia isso com `await` dentro do `for`, então 6
 * resultados viravam 6 chamadas em fila. Aqui tudo sai junto.
 */
async function enriquecerCeps(sugestoes: EnderecoSugestao[], numero?: string): Promise<EnderecoSugestao[]> {
  const pendentes = sugestoes.filter(s => !s.cep && s.cidade && s.logradouro && s.estado)
  if (pendentes.length === 0) return sugestoes

  await Promise.all(
    pendentes.slice(0, 6).map(async s => {
      const rua = s.logradouro.replace(/^(rua|avenida|av\.?)\s+/i, "")
      const [achado] = await viacepPorRua(s.estado, s.cidade, rua, numero)
      if (achado?.cep) {
        s.cep = achado.cep
        if (!s.bairro) s.bairro = achado.bairro
      }
    })
  )
  return sugestoes
}

/** Busca por CEP: ViaCEP e, se falhar, BrasilAPI. */
export async function buscarPorCep(cep: string): Promise<EnderecoSugestao[]> {
  const viacep = await viacepPorCep(cep)
  if (viacep) return [viacep]

  const brasilapi = await brasilapiPorCep(cep)
  return brasilapi ? [brasilapi] : []
}

/** Busca por texto livre: ViaCEP (cidade provável) + Photon, em paralelo. */
export async function buscarPorTexto(busca: BuscaParseada): Promise<EnderecoSugestao[]> {
  const { rua, ruaSemPrefixo, cidade, uf, numero } = busca
  if (ruaSemPrefixo.length < 3) return []

  const cidadeAlvo = cidade ?? "Ribeirão Preto"
  const ufAlvo     = uf ?? "SP"

  const consultaPhoton = [rua, numero, cidade].filter(Boolean).join(" ")

  const [viacepCidade, photon] = await Promise.all([
    viacepPorRua(ufAlvo, cidadeAlvo, ruaSemPrefixo, numero),
    photonBusca(consultaPhoton, 8),
  ])

  return enriquecerCeps([...viacepCidade, ...photon], numero)
}
