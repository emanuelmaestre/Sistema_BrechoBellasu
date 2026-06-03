export interface ConfiguracaoEmpresa {
  nome: string
  cnpj?: string
  telefone?: string
  email?: string
  logradouro?: string
  numero?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
  instagram?: string
  taxa_entrega?: string
}

export interface ConfiguracaoAlerta {
  alerta_numero_1?: string
  alerta_numero_2?: string
}

export type ChaveConfiguracao = "empresa" | "alertas"
