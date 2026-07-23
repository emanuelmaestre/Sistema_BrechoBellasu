// ══════════════════════════════════════════════════════════════════
// Parsing e normalização de endereços digitados em texto livre.
//
// Funções puras — sem I/O, sem React. Usadas tanto pela rota
// /api/enderecos/buscar quanto pelos testes.
// ══════════════════════════════════════════════════════════════════

export interface EnderecoSugestao {
  cep:        string
  logradouro: string
  bairro:     string
  cidade:     string
  estado:     string
  /** Fonte que produziu a sugestão — usada para exibir o selo na UI. */
  fonte:      "cadastro" | "viacep" | "brasilapi" | "photon"
  /** Número extraído da frase digitada, injetado no form ao selecionar. */
  numero?:    string
  /** Complemento extraído da frase (APTO, CASA, BLOCO...). */
  complemento?: string
  /** Quantos clientes já cadastrados moram neste endereço. */
  ocorrencias?: number
  /** Pontuação de relevância — preenchida por `ordenarSugestoes`. */
  score?:     number
}

/** Coordenadas da loja — usadas como viés geográfico na busca externa. */
export const LOJA_COORD = { lat: -21.1775, lon: -47.8103 } // Ribeirão Preto/SP

export const ESTADO_SIGLA: Record<string, string> = {
  "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM", "Bahia": "BA",
  "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES", "Goiás": "GO",
  "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR",
  "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", "Rondônia": "RO",
  "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP",
  "Sergipe": "SE", "Tocantins": "TO",
}

const UFS = Object.values(ESTADO_SIGLA)

/** Minúsculas, sem acento, espaços colapsados. */
export function normAddr(s: string): string {
  return (s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim()
}

/** Expande abreviações comuns de logradouro e títulos. */
export function expandAbrev(s: string): string {
  return (s ?? "")
    .replace(/\bR\.\s*/gi, "Rua ")
    .replace(/\bAv\.?\s+/gi, "Avenida ")
    .replace(/\bTrav\.\s*/gi, "Travessa ")
    .replace(/\bTv\.\s*/gi, "Travessa ")
    .replace(/\bAl\.\s*/gi, "Alameda ")
    .replace(/\bPr?\.\s*/gi, "Praça ")
    .replace(/\bEstr\.\s*/gi, "Estrada ")
    .replace(/\bRod\.\s*/gi, "Rodovia ")
    .replace(/\bCon[dj]\.\s*/gi, "Condomínio ")
    .replace(/\bDr\.\s*/gi, "Doutor ")
    .replace(/\bDra\.\s*/gi, "Doutora ")
    .replace(/\bProf\.\s*/gi, "Professor ")
    .replace(/\bProfa\.\s*/gi, "Professora ")
    .replace(/\bEng\.\s*/gi, "Engenheiro ")
    .replace(/\bDep\.\s*/gi, "Deputado ")
    .replace(/\bVer\.\s*/gi, "Vereador ")
    .replace(/\bCel\.\s*/gi, "Coronel ")
    .replace(/\bCap\.\s*/gi, "Capitão ")
    .replace(/\s+/g, " ").trim()
}

const RE_COMPLEMENTO = /\b(casa|apto?|ap|bloco|bl|lote|lt|sala|sl|conj|cj|andar|pavimento|pav|kit|kf|fundos)\s*\.?\s*[\d\w]*/gi
const RE_PREFIXO_RUA = /^(rua|avenida|travessa|alameda|praca|praça|estrada|rodovia|largo|beco|viela|vila|via)\s+/i

export interface BuscaParseada {
  /** CEP com 8 dígitos, se a entrada for um CEP. */
  cep:          string | null
  /** Nome da rua isolado (sem número, cidade, UF ou complemento). */
  rua:          string
  /** Rua sem o prefixo de tipo — é o que o ViaCEP espera. */
  ruaSemPrefixo: string
  numero:       string
  complemento:  string
  cidade:       string | null
  uf:           string | null
  /** Tokens normalizados para busca no banco. */
  tokens:       string[]
}

/**
 * Desmonta uma frase de endereço digitada em texto livre.
 *
 * "Av. Brasil 200 apto 3, Ribeirão Preto SP"
 *   → { rua: "Avenida Brasil", numero: "200", complemento: "apto 3",
 *       cidade: "Ribeirão Preto", uf: "SP" }
 */
export function parseBusca(entrada: string): BuscaParseada {
  const bruto = (entrada ?? "").trim()
  const soDigitos = bruto.replace(/\D/g, "")

  // CEP puro (com ou sem hífen) — caminho curto.
  if (soDigitos.length === 8 && /^[\d.\-\s]+$/.test(bruto)) {
    return {
      cep: soDigitos, rua: "", ruaSemPrefixo: "", numero: "",
      complemento: "", cidade: null, uf: null, tokens: [],
    }
  }

  const expandido = expandAbrev(bruto)

  // Complemento (APTO 3, CASA 57, BL 2...) sai antes de procurar o número,
  // senão o "3" do apto vira o número da casa.
  const complemento = (expandido.match(RE_COMPLEMENTO) ?? []).join(" ").trim()
  const semCompl = expandido.replace(RE_COMPLEMENTO, " ").replace(/\s+/g, " ").trim()

  // Número da casa: 1 a 5 dígitos que não sejam parte de um CEP.
  const numero = semCompl.match(/\b(\d{1,5})\b/)?.[1] ?? ""

  // UF só conta como UF se estiver isolada (evita "AL" de "ALAMEDA").
  const uf = semCompl.match(new RegExp(`\\b(${UFS.join("|")})\\b`))?.[1]?.toUpperCase() ?? null

  // Cidade: qualquer nome de estado por extenso já saiu na UF; aqui
  // detectamos a cidade pelo que sobra depois de uma vírgula final,
  // que é como a maioria das pessoas escreve.
  const partes = semCompl.split(",").map(p => p.trim()).filter(Boolean)
  let cidade: string | null = null
  if (partes.length > 1) {
    const ultima = partes[partes.length - 1]
      .replace(new RegExp(`\\b(${UFS.join("|")})\\b`, "gi"), "")
      .replace(/[\d\-\/]/g, "").trim()
    if (ultima.length >= 3) cidade = ultima
  }

  // Rua = primeira parte, sem número, sem UF.
  const primeiraParte = partes[0] ?? semCompl
  const rua = primeiraParte
    .replace(/\b\d{1,5}\b/g, " ")
    .replace(new RegExp(`\\b(${UFS.join("|")})\\b`, "gi"), " ")
    .replace(/[,.\-]/g, " ")
    .replace(/\s+/g, " ").trim()

  const ruaSemPrefixo = rua.replace(RE_PREFIXO_RUA, "").trim()

  const tokens = normAddr(`${rua} ${cidade ?? ""}`).split(" ").filter(t => t.length >= 3)

  return { cep: null, rua, ruaSemPrefixo, numero, complemento, cidade, uf, tokens }
}

// ── Faixa numérica do CEP ────────────────────────────────────────
// Ruas longas têm vários CEPs. O ViaCEP devolve a faixa no campo
// `complemento`, ex.: "de 1048 a 1698 - lado par", "até 610 - lado ímpar",
// "de 611 ao fim". Usamos isso para escolher o CEP certo pelo número
// que a pessoa digitou — antes o sistema pegava sempre o primeiro.

/**
 * @returns true se o número está na faixa, false se está fora,
 *          null se a faixa não pôde ser interpretada.
 */
export function faixaContemNumero(
  complementoCep: string | null | undefined,
  numero: string | number,
): boolean | null {
  const n = typeof numero === "number" ? numero : parseInt(numero, 10)
  if (!Number.isFinite(n)) return null

  const bruto = normAddr(complementoCep ?? "")
  if (!bruto) return null

  // O ViaCEP escreve os limites que valem para os dois lados da rua como
  // "5000/5001" (par/ímpar). Reduzimos cada par ao limite correto: o menor
  // quando é início de faixa, o maior quando é fim.
  const c = bruto
    .replace(/de\s+(\d+)\/(\d+)/g,  (_m, a, b) => `de ${Math.min(+a, +b)}`)
    .replace(/\ba\s+(\d+)\/(\d+)/g, (_m, a, b) => `a ${Math.max(+a, +b)}`)
    .replace(/ate\s+(\d+)\/(\d+)/g, (_m, a, b) => `ate ${Math.max(+a, +b)}`)

  // Paridade do lado da rua.
  if (c.includes("lado par") && n % 2 !== 0) return false
  if (c.includes("lado impar") && n % 2 === 0) return false

  const deA = c.match(/de\s+(\d+)\s+a\s+(\d+)/)
  if (deA) return n >= parseInt(deA[1], 10) && n <= parseInt(deA[2], 10)

  const deAoFim = c.match(/de\s+(\d+)\s+ao\s+fim/)
  if (deAoFim) return n >= parseInt(deAoFim[1], 10)

  const ate = c.match(/ate\s+(\d+)/)
  if (ate) return n <= parseInt(ate[1], 10)

  // Só tinha informação de lado (par/ímpar) e ela bateu.
  if (c.includes("lado par") || c.includes("lado impar")) return true

  return null
}

// ── Relevância ───────────────────────────────────────────────────

/**
 * Pontua uma sugestão contra o que foi digitado.
 *
 * Diferente da versão anterior, endereços de Ribeirão Preto NÃO são
 * forçados para o topo: o desempate por proximidade agora é feito pelo
 * viés geográfico enviado ao Photon. Aqui o que manda é a semelhança
 * real com o texto digitado.
 */
export function scoreSugestao(s: EnderecoSugestao, busca: BuscaParseada): number {
  let score = 0
  const rua    = normAddr(s.logradouro)
  const bairro = normAddr(s.bairro)
  const cidade = normAddr(s.cidade)
  const alvo   = normAddr(busca.rua)
  const alvoSemPrefixo = normAddr(busca.ruaSemPrefixo)

  // Endereço que já existe no cadastro é o mais confiável: a grafia é a
  // que a loja usa e o CEP já foi validado numa etiqueta anterior.
  if (s.fonte === "cadastro") score += 120
  if (s.ocorrencias && s.ocorrencias > 1) score += Math.min(s.ocorrencias * 5, 40)

  if (alvo && rua === alvo) score += 100
  else if (alvoSemPrefixo && rua.includes(alvoSemPrefixo)) score += 70
  else if (alvo && rua.includes(alvo)) score += 60

  if (alvoSemPrefixo && rua.startsWith(alvoSemPrefixo)) score += 30

  // Cidade explicitamente pedida bate.
  if (busca.cidade && cidade.includes(normAddr(busca.cidade))) score += 80

  // Bairro mencionado na frase.
  if (bairro && alvo.includes(bairro)) score += 20

  if (s.cep) score += 15
  if (s.estado) score += 5

  return score
}

/** Ordena por relevância e remove duplicatas de rua+bairro+cidade. */
export function ordenarSugestoes(
  sugestoes: EnderecoSugestao[],
  busca: BuscaParseada,
): EnderecoSugestao[] {
  const vistos = new Set<string>()
  const unicas: EnderecoSugestao[] = []

  for (const s of sugestoes) {
    if (!s.logradouro) continue
    const chave = normAddr(`${s.logradouro}|${s.bairro}|${s.cidade}`)
    if (vistos.has(chave)) continue
    vistos.add(chave)
    unicas.push({ ...s, score: scoreSugestao(s, busca) })
  }

  return unicas.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}

// ── Completude para envio ────────────────────────────────────────

export interface EnderecoParcial {
  cep?:        string | null
  logradouro?: string | null
  numero?:     string | null
  bairro?:     string | null
  cidade?:     string | null
  estado?:     string | null
}

/**
 * Campos que o Melhor Envio exige para emitir a etiqueta.
 * Serve para avisar no cadastro, e não só na hora do envio.
 */
export function camposFaltantesEnvio(e: EnderecoParcial): string[] {
  const faltando: string[] = []
  if ((e.cep ?? "").replace(/\D/g, "").length !== 8) faltando.push("CEP")
  if (!(e.logradouro ?? "").trim()) faltando.push("Logradouro")
  if (!(e.numero ?? "").trim())     faltando.push("Número")
  if (!(e.cidade ?? "").trim())     faltando.push("Cidade")
  if (!(e.estado ?? "").trim())     faltando.push("Estado")
  return faltando
}

/** True quando o endereço está pronto para gerar etiqueta. */
export function enderecoCompletoParaEnvio(e: EnderecoParcial): boolean {
  return camposFaltantesEnvio(e).length === 0
}
