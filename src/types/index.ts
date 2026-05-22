// ══════════════════════════════════════
// Tipos globais do sistema
// ══════════════════════════════════════

export interface Usuario {
  id: number
  nome: string
  email: string
  perfil: "administrador" | "gerente" | "vendedor" | "caixa"
  status: "ativo" | "inativo"
}

export interface Cliente {
  id: number
  nome: string
  email?: string
  cpf?: string
  celular?: string
  telefone?: string
  endereco?: string
  cidade?: string
  estado?: string
  nascimento?: string
  status: "ativo" | "inativo"
  created_at: string
}

export interface Categoria {
  id: number
  nome: string
}

export interface Produto {
  id: number
  nome: string
  codigo?: string
  categoria_id?: number
  categoria_nome?: string
  marca?: string
  preco_venda: number
  preco_custo?: number
  estoque_atual: number
  controlar_estoque: boolean
  unidade_medida?: string
  created_at: string
}

export interface VendaItem {
  id?: number
  produto_id: number
  produto_nome?: string
  quantidade: number
  preco_unitario: number
  subtotal: number
}

export interface Venda {
  id: number
  numero: string
  cliente_id?: number
  cliente_nome?: string
  data_venda: string
  hora_venda?: string
  forma_pagamento: string
  desconto_geral?: number
  total: number
  troco?: number
  observacoes?: string
  itens?: VendaItem[]
  created_at: string
}

export interface ContaPagar {
  id: number
  descricao: string
  valor: number
  vencimento: string
  status: "pendente" | "pago" | "vencido"
  categoria?: string
  fornecedor?: string
  created_at: string
}

export interface ContaReceber {
  id: number
  descricao: string
  valor: number
  vencimento: string
  status: "pendente" | "recebido"
  cliente_id?: number
  cliente_nome?: string
  forma_pagamento?: string
  created_at: string
}

export interface Troca {
  id: number
  tipo: "troca" | "devolucao"
  cliente_id?: number
  cliente_nome?: string
  produto_id?: number
  produto_nome?: string
  motivo?: string
  status: string
  valor?: number
  created_at: string
}

export interface Live {
  id: number
  titulo: string
  data_live: string
  status: "aberta" | "encerrada" | "disparada"
  descricao?: string
  created_at: string
}

export interface Pagamento {
  id: number
  pagbank_order_id?: string
  venda_id?: number
  live_compra_id?: number
  tipo: "pix" | "link"
  valor: number
  descricao?: string
  status: string
  qr_code?: string
  qr_code_text?: string
  link_pagamento?: string
  pago_em?: string
  criado_em: string
}

export interface ApiResponse<T> {
  data: T
  total?: number
  error?: string
}
