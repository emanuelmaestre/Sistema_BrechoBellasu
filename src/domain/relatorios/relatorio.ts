export interface PeriodoRelatorio {
  de: string  // ISO date
  ate: string // ISO date
}

export interface VendaPorPeriodo {
  data: string
  total: number
  quantidade: number
}

export interface RelatorioVendas {
  periodo: PeriodoRelatorio
  totalGeral: number
  ticketMedio: number
  quantidadeVendas: number
  vendasPorDia: VendaPorPeriodo[]
  formasPagamento: Record<string, number>
  topProdutos: Array<{ nome: string; quantidade: number; total: number }>
  topClientes: Array<{ nome: string; total: number; quantidadeCompras: number }>
}
