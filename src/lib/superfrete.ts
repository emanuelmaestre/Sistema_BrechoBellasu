// ══════════════════════════════════════════════════════════
// Super Frete — API client
// Docs: https://superfrete.com/api
// Env vars necessárias:
//   SUPERFRETE_TOKEN     — Bearer token da conta Super Frete
//   SUPERFRETE_SENDER_ID — ID do remetente cadastrado no painel
//   SUPERFRETE_CEP_ORIGEM (opcional) — sobrescreve MELHOR_ENVIO_CEP_ORIGEM
// ══════════════════════════════════════════════════════════

// Ambiente configurável: por padrão produção. Defina SUPERFRETE_ENV=sandbox
// para testar com um token de sandbox (etiquetas de sandbox NÃO são válidas
// para envio real). ATENÇÃO: tokens são específicos por ambiente — um token
// de sandbox contra a URL de produção retorna 401 "Token inválida!".
export function sfBaseUrl(): string {
  return process.env.SUPERFRETE_ENV === "sandbox"
    ? "https://sandbox.superfrete.com/api/v0"
    : "https://api.superfrete.com/api/v0"
}

const SF_BASE_URL = sfBaseUrl()

// A API do Super Frete EXIGE o header User-Agent no formato
// "Aplicação e VERSÃO (email de contato)". Sem ele — ou fora do formato —
// a API responde 401 "Token inválida!" mesmo com o Bearer token correto.
// O valor anterior não trazia a versão, o que pode ser a causa do 401.
const SF_USER_AGENT =
  process.env.SUPERFRETE_USER_AGENT ??
  "Brecho Bellasu 1.0 (sueli.maestre@gmail.com)"

function getToken() {
  const t = process.env.SUPERFRETE_TOKEN
  if (!t) throw new Error("SUPERFRETE_TOKEN não configurado. Adicione nas variáveis de ambiente da Vercel.")
  return t
}

function getSenderId() {
  const id = process.env.SUPERFRETE_SENDER_ID
  if (!id) throw new Error("SUPERFRETE_SENDER_ID não configurado. Adicione nas variáveis de ambiente da Vercel.")
  return id
}

export function sfCepOrigem(): string {
  return (
    process.env.SUPERFRETE_CEP_ORIGEM ??
    process.env.MELHOR_ENVIO_CEP_ORIGEM ??
    "14010080"
  )
}

export function sfDefaultVolume() {
  return {
    height:  parseFloat(process.env.MELHOR_ENVIO_ALTURA      ?? "5"),
    width:   parseFloat(process.env.MELHOR_ENVIO_LARGURA     ?? "20"),
    length:  parseFloat(process.env.MELHOR_ENVIO_COMPRIMENTO ?? "30"),
    weight:  parseFloat(process.env.MELHOR_ENVIO_PESO        ?? "0.5"),
  }
}

export function sfConfigurado(): boolean {
  return !!(process.env.SUPERFRETE_TOKEN && process.env.SUPERFRETE_SENDER_ID)
}

async function sfRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${SF_BASE_URL}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization:  `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      Accept:         "application/json",
      "User-Agent":   SF_USER_AGENT,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Super Frete ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
  }

  const text = await res.text()
  if (!text || text.trim() === "") return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Super Frete resposta inválida: ${text.slice(0, 200)}`)
  }
}

// ── Tipos ────────────────────────────────────────────────

export interface SFEndereco {
  name:        string
  phone?:      string
  email?:      string
  document?:   string
  address:     string
  complement?: string
  number:      string
  district:    string
  city:        string
  state_abbr:  string   // UF — "SP", "MG" etc.
  country:     string   // "BR"
  postal_code: string
}

export interface SFVolume {
  height: number
  width:  number
  length: number
  weight: number
}

/** Resultado normalizado de cotação — mesma interface usada na UI */
export interface SFCotacaoResult {
  id:            number
  name:          string
  price:         string
  currency:      string
  delivery_time: number
  delivery_range: { min: number; max: number }
  company:       { id: number; name: string; picture: string }
  error?:        string
}

export interface SFCartItem {
  service:    number
  sender_id:  string
  from:       SFEndereco
  to:         SFEndereco
  volumes:    SFVolume[]
  products?:  Array<{ name: string; quantity: number; unitary_value: number }>
  options?:   {
    insurance_value?: number
    non_commercial?:  boolean
    platform?:        string
  }
  tag?: string
}

export interface SFOrder {
  id:              string
  protocol:        string
  service_id?:     number
  status:          string
  tracking:        string | null
  self_tracking?:  string | null
  label_url?:      string
  created_at:      string
  paid_at?:        string | null
  price?:          string
  to?:             SFEndereco
  delivery_range?: { min: number; max: number }
}

// ── Funções ─────────────────────────────────────────────

/** Calcula frete — retorna lista de serviços disponíveis */
export async function sfCalcularFrete(params: {
  cep_origem:  string
  cep_destino: string
  volume:      SFVolume
  valor_declarado?: number
}): Promise<SFCotacaoResult[]> {
  const { cep_origem, cep_destino, volume, valor_declarado } = params

  const payload = {
    from:    { postal_code: cep_origem.replace(/\D/g, "") },
    to:      { postal_code: cep_destino.replace(/\D/g, "") },
    // A API do Super Frete exige a lista de serviços a cotar.
    // 1=PAC, 2=SEDEX, 17=Mini Envios (padrão configurável via SUPERFRETE_SERVICES).
    services: process.env.SUPERFRETE_SERVICES ?? "1,2,17",
    package: {
      weight: volume.weight,
      width:  volume.width,
      height: volume.height,
      length: volume.length,
    },
    // "options" é obrigatório na doc — antes só era enviado quando havia
    // valor declarado, deixando a maior parte das cotações sem o campo.
    options: {
      own_hand:            false,
      receipt:             false,
      insurance_value:     valor_declarado ?? 0,
      use_insurance_value: !!valor_declarado,
    },
  }

  const data = await sfRequest<SFCotacaoResult[] | { data?: SFCotacaoResult[] }>("POST", "/calculator", payload)
  const list = Array.isArray(data) ? data : ((data as { data?: SFCotacaoResult[] }).data ?? [])
  return list
}

/** Adiciona etiqueta ao carrinho */
export async function sfAdicionarCarrinho(item: SFCartItem): Promise<SFOrder> {
  // "platform" é campo obrigatório de topo na doc do /cart (não dentro de options).
  const payload = {
    ...item,
    sender_id: getSenderId(),
    platform:  item.options?.platform ?? "Brecho Bellasu",
  }
  const result = await sfRequest<SFOrder | { data?: SFOrder }>("POST", "/cart", payload)
  if ("data" in result && result.data) return result.data
  return result as SFOrder
}

/** Faz checkout — paga com saldo da carteira */
export async function sfCheckout(orderIds: string[]): Promise<{ purchased: SFOrder[]; errors: unknown[] }> {
  const result = await sfRequest<{ purchased?: SFOrder[]; errors?: unknown[] }>(
    "POST", "/checkout", { orders: orderIds }
  )
  return {
    purchased: result.purchased ?? [],
    errors:    result.errors    ?? [],
  }
}

// Não existe "sfGerarEtiquetas" no Super Frete: o próprio /checkout já
// finaliza o pedido E gera a etiqueta (diferente do Melhor Envio, que tem
// um /generate separado). Chamar /generate era uma requisição inútil.

/** Retorna URL do PDF para impressão */
export async function sfImprimirEtiqueta(orderIds: string[]): Promise<{ url: string }> {
  return sfRequest("POST", "/tag/print", { orders: orderIds })
}

/** Busca pedido pelo ID (fonte de verdade após checkout) */
export async function sfBuscarPedido(orderId: string): Promise<SFOrder> {
  const result = await sfRequest<SFOrder | { data?: SFOrder }>("GET", `/order/info/${orderId}`)
  if ("data" in result && result.data) return result.data
  return result as SFOrder
}

/** Cancela uma etiqueta */
export async function sfCancelarEtiqueta(orderId: string, motivo = "Cancelamento solicitado pelo lojista"): Promise<{ message: string }> {
  return sfRequest("POST", "/order/cancel", { order: { id: orderId, reason: motivo } })
}

/** Rastreia pelo código de rastreio */
export async function sfRastrear(tracking: string): Promise<{
  tracking: string
  events:   Array<{ description: string; date: string; location: string }>
}> {
  try {
    const raw = await sfRequest<
      Record<string, { tracking: string; events: Array<{ description: string; date: string; location: string }> }>
    >("GET", `/tracking/${tracking}`)
    const item = raw[tracking] ?? Object.values(raw)[0]
    if (!item) return { tracking, events: [] }
    return item
  } catch {
    return { tracking, events: [] }
  }
}

/** Saldo da carteira */
export async function sfSaldo(): Promise<{ balance: number }> {
  return sfRequest("GET", "/balance")
}

/** Dados do usuário (para teste de token) */
export async function sfUsuario(): Promise<{ id: number; name: string; email: string }> {
  // Caminho correto conforme a doc oficial: GET /api/v0/user (não "/user/me").
  // Com "/user/me" a API devolve HTTP 200 com uma página HTML em vez de JSON,
  // o que fazia o teste de conexão falhar sempre — mesmo com token válido.
  return sfRequest("GET", "/user")
}
