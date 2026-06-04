// ══════════════════════════════════════════════════════════════════
// Monta o registro de uma etiqueta para persistir no histórico do cliente.
// Centralizado para evitar duplicação entre /api/etiquetas e /api/etiquetas/pix.
// Preserva um snapshot dos dados usados no momento da emissão.
// ══════════════════════════════════════════════════════════════════

export interface DestinatarioEtiqueta {
  nome?: string
  telefone?: string
  cpf?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  postal_code?: string | number
  [k: string]: unknown
}

export interface RegistroEtiqueta {
  me_order_id: string
  me_protocol: string | null
  me_tracking: string | null
  cliente_id: number | null
  venda_id: number | null
  service_id: number
  status: string
  cep_destino: string
  label_url: string | null
  criado_por: number | null
  nome_cliente_snapshot: string | null
  endereco_snapshot: Record<string, unknown>
  tipo_etiqueta: string | null
  dados_json: Record<string, unknown>
}

export function montarEnderecoSnapshot(d: DestinatarioEtiqueta): Record<string, unknown> {
  return {
    logradouro:  d.logradouro  ?? "",
    numero:      d.numero      ?? "",
    complemento: d.complemento ?? "",
    bairro:      d.bairro      ?? "",
    cidade:      d.cidade      ?? "",
    estado:      d.estado      ?? "",
    cep:         String(d.postal_code ?? "").replace(/\D/g, ""),
  }
}

export function montarRegistroEtiqueta(params: {
  me_order_id: string
  me_protocol?: string | null
  me_tracking?: string | null
  cliente_id?: number | null
  venda_id?: number | null
  service_id: number
  status?: string | null
  destinatario: DestinatarioEtiqueta
  tipo_etiqueta?: string | null
  label_url?: string | null
  criado_por?: number | null
}): RegistroEtiqueta {
  const { destinatario: d } = params
  return {
    me_order_id:           params.me_order_id,
    me_protocol:           params.me_protocol ?? null,
    me_tracking:           params.me_tracking ?? null,
    cliente_id:            params.cliente_id ?? null,
    venda_id:              params.venda_id ?? null,
    service_id:            params.service_id,
    status:                params.status ?? "pending",
    cep_destino:           String(d.postal_code ?? "").replace(/\D/g, ""),
    label_url:             params.label_url ?? null,
    criado_por:            params.criado_por ?? null,
    nome_cliente_snapshot: d.nome ?? null,
    endereco_snapshot:     montarEnderecoSnapshot(d),
    tipo_etiqueta:         params.tipo_etiqueta ?? null,
    dados_json:            { destinatario: d, service_id: params.service_id },
  }
}
