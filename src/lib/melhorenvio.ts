// ══════════════════════════════════════
// Melhor Envio — API client
// Docs: https://docs.melhorenvio.com.br
// ══════════════════════════════════════

const SANDBOX_URL    = "https://sandbox.melhorenvio.com.br/api/v2"
const PRODUCTION_URL = "https://melhorenvio.com.br/api/v2"

function getBaseUrl() {
  return process.env.MELHOR_ENVIO_ENV === "production" ? PRODUCTION_URL : SANDBOX_URL
}

function getToken() {
  const t = process.env.MELHOR_ENVIO_TOKEN
  if (!t) throw new Error("MELHOR_ENVIO_TOKEN não configurado.")
  return t
}

// User-Agent obrigatório pela API do Melhor Envio
const USER_AGENT = "Brecho Bellasu (contato@brechobellasu.com.br)"

async function meRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url   = `${getBaseUrl()}${path}`
  const token = getToken()

  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept":       "application/json",
      "User-Agent":   USER_AGENT,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Melhor Envio ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
  }

  const text = await res.text()
  if (!text || text.trim() === "") return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Melhor Envio resposta inválida: ${text.slice(0, 200)}`)
  }
}

// ── Tipos ───────────────────────────────────────
export interface MEEndereco {
  name:        string
  phone?:      string
  email?:      string
  document?:   string       // CPF do destinatário (pessoa física)
  company_document?: string
  address:     string
  complement?: string
  number:      string
  district:    string
  city:        string
  state_abbr:  string
  country_id:  string       // "BR"
  postal_code: string
  note?:       string
}

export interface MEVolume {
  height:  number  // cm
  width:   number  // cm
  length:  number  // cm
  weight:  number  // kg
}

export interface MECotacaoPayload {
  from:     { postal_code: string }
  to:       { postal_code: string }
  package:  MEVolume
  options?: {
    receipt?:   boolean
    own_hand?:  boolean
    collect?:   boolean
  }
  services?: string  // ex: "1,2,3" — IDs das transportadoras
}

export interface MECotacaoResult {
  id:           number
  name:         string
  price:        string
  currency:     string
  delivery_time:number
  delivery_range:{ min: number; max: number }
  company:      { id: number; name: string; picture: string }
  error?:       string
}

export interface MECartItem {
  service:     number          // ID do serviço (transportadora)
  agency?:     number
  from:        MEEndereco
  to:          MEEndereco
  products?:   Array<{ name: string; quantity: number; unitary_value: number }>
  volumes:     MEVolume[]
  options?:    { insurance_value?: number; receipt?: boolean; own_hand?: boolean; reverse?: boolean; non_commercial?: boolean; invoice?: { key: string }; platform?: string }
  tag?:        string
  url?:        string
}

export interface MEOrder {
  id:              string
  protocol:        string
  service_id:      number
  status:          string
  tracking:        string | null
  self_tracking?:  string | null
  label_url?:      string
  created_at:      string
  paid_at?:        string | null
  generated_at?:   string | null
  to:              MEEndereco
  price?:          string
  delivery_range?: { min: number; max: number }
}

// ── Funções ─────────────────────────────────────

/** Calcula frete — retorna lista de opções de transportadoras */
export function calcularFrete(payload: MECotacaoPayload) {
  return meRequest<MECotacaoResult[]>("POST", "/me/shipment/calculate", payload)
}

/** Adiciona etiqueta ao carrinho.
 *  O endpoint /me/cart da ME espera um OBJETO ÚNICO (não array). Enviar
 *  array faz a API ignorar o campo `products` e retornar 422 ("declaração
 *  de conteúdo"). Por isso enviamos um item por vez como objeto. */
export async function adicionarCarrinho(items: MECartItem[]): Promise<MEOrder[]> {
  const orders: MEOrder[] = []
  for (const item of items) {
    const result = await meRequest<MEOrder | MEOrder[]>("POST", "/me/cart", item)
    if (Array.isArray(result)) orders.push(...result)
    else orders.push(result)
  }
  return orders
}

/** Faz checkout das etiquetas no carrinho (desconta saldo da carteira) */
export function checkoutEtiquetas(orders: string[]) {
  return meRequest<{ purchased: MEOrder[]; errors: unknown[] }>("POST", "/me/shipment/checkout", { orders })
}

/** Faz checkout via PIX (gera QR Code para pagar a etiqueta) */
export function checkoutComPix(orders: string[]) {
  return meRequest<{
    purchased?: MEOrder[]
    payment?: { qr_code?: string; qr_code_base64?: string; copy_paste?: string; expires_at?: string }
    pix?: { qr_code?: string; qr_code_base64?: string; copy_paste?: string; expires_at?: string }
    errors?: unknown[]
  }>("POST", "/me/shipment/checkout", { orders, payment_method: "pix" })
}

/** Gera as etiquetas (após checkout). O formato de resposta da ME varia,
 *  por isso não dependemos dele — usamos buscarPedido() como fonte de verdade. */
export function gerarEtiquetas(orders: string[]) {
  return meRequest<unknown>("POST", "/me/shipment/generate", { orders })
}

/** Busca um pedido específico (fonte de verdade após checkout/generate) */
export function buscarPedido(orderId: string) {
  return meRequest<MEOrder>("GET", `/me/orders/${orderId}`)
}

/** Retorna a URL do PDF da etiqueta já paga/gerada (não gera cobrança) */
export function imprimirEtiqueta(orders: string[]) {
  return meRequest<{ url: string }>("POST", "/me/shipment/print", { mode: "public", orders })
}

/** Lista etiquetas/pedidos do usuário */
export function listarEtiquetas(params?: { filter?: string; per_page?: number; page?: number }) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
  ).toString()
  return meRequest<{ data: MEOrder[]; meta: { total: number; current_page: number; last_page: number } }>(
    "GET", `/me/orders${qs ? "?" + qs : ""}`
  )
}

/** Rastreia um pedido pelo orderId (ORD-...).
 *  A API do ME retorna { [orderId]: { tracking, events } } — extraímos o item.
 *  Retorna events vazio se etiqueta ainda não foi postada ou não tem rastreio. */
export async function rastrearEtiqueta(
  orderId: string
): Promise<{ tracking: string; events: Array<{ description: string; date: string; location: string }> }> {
  try {
    // ME aceita tanto orders[]=X quanto orders%5B%5D=X — usar sem encode nos colchetes
    const raw = await meRequest<Record<string, { tracking: string; events: Array<{ description: string; date: string; location: string }> }>>(
      "GET", `/me/shipment/tracking?orders[]=${orderId}`
    )
    // Melhor Envio devolve { "ORD-xxx": { tracking, events } }
    const item = raw[orderId] ?? Object.values(raw)[0]
    // Etiqueta gerada mas ainda não postada — retorna events vazio
    if (!item) return { tracking: orderId, events: [] }
    return item
  } catch {
    // Etiqueta sem histórico de rastreio ainda (não postada/sem coleta registrada)
    return { tracking: orderId, events: [] }
  }
}

/** Cancela uma etiqueta */
export function cancelarEtiqueta(orderId: string) {
  return meRequest<{ message: string }>("DELETE", `/me/cart/${orderId}`)
}

/** Retorna dados do usuário autenticado (útil para testar token) */
export function meUsuario() {
  return meRequest<{ id: number; firstname: string; lastname: string; email: string }>("GET", "/me")
}

/** Retorna saldo da carteira Melhor Envio.
 *  A API responde { balance, reserved, debts } como números. */
export function meSaldo() {
  return meRequest<{ balance: number; reserved?: number; debts?: number }>("GET", "/me/balance")
}

/** Cria recarga na carteira via PIX */
export function meRecarregar(valor: number) {
  return meRequest<{ id: string; value: string; status: string; payment: { type: string; qr_code?: string; qr_code_base64?: string; copy_paste?: string; expires_at?: string } }>(
    "POST", "/me/wallet/recharges", { value: valor, type: "pix" }
  )
}

/** Configurações padrão de embalagem vindas de .env */
export function defaultVolume(): MEVolume {
  return {
    height:  parseFloat(process.env.MELHOR_ENVIO_ALTURA     ?? "5"),
    width:   parseFloat(process.env.MELHOR_ENVIO_LARGURA    ?? "20"),
    length:  parseFloat(process.env.MELHOR_ENVIO_COMPRIMENTO ?? "30"),
    weight:  parseFloat(process.env.MELHOR_ENVIO_PESO       ?? "0.5"),
  }
}

export function cepOrigem() {
  return process.env.MELHOR_ENVIO_CEP_ORIGEM ?? "14010080"
}
