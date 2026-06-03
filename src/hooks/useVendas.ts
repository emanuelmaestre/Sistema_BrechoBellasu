import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost, apiPatch } from "@/services/api"

export interface VendaListItem {
  id: number
  numero: number
  data_venda: string
  hora_venda: string
  cliente_id?: number | null
  cliente_nome?: string | null
  vendedor_nome?: string | null
  qtd_itens: number
  total: number
  forma_pagamento: string
  status?: string | null
  desconto?: number | null
  observacoes?: string | null
  notificacao_status?: "pendente" | "enviado" | "erro" | null
}

export interface VendaDetalheItem {
  id?: number
  produto_id?: number | null
  produto_nome?: string | null
  nome?: string | null
  quantidade: number
  preco_unitario: number
  subtotal: number
}

export interface VendaDetalhe extends VendaListItem {
  desconto: number | null
  observacoes: string | null
  itens: VendaDetalheItem[]
}

interface VendasParams {
  de?: string
  ate?: string
  cliente_id?: number
  page?: number
}

interface VendasResponse {
  data: VendaListItem[]
  total: number
}

export function useVendas(params: VendasParams = {}) {
  const { data, isLoading, error, refetch } = useQuery<VendasResponse>({
    queryKey: ["vendas", params],
    queryFn: () =>
      apiGet<VendasResponse>("/vendas", params as Record<string, unknown>),
  })

  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
  }
}

export function useVenda(id: number) {
  const { data, isLoading, error } = useQuery<VendaDetalhe>({
    queryKey: ["venda", id],
    queryFn: () => apiGet<VendaDetalhe>(`/vendas/${id}`),
    enabled: !!id,
  })

  return {
    data: data ?? null,
    isLoading,
    error,
  }
}

export function useCreateVenda() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      cliente_id?: number | null
      forma_pagamento: string
      desconto_geral?: number
      observacoes?: string | null
      itens: Array<{
        produto_id?: number | null
        nome_produto?: string
        quantidade: number
        preco_unitario: number
      }>
    }) => apiPost<{ id: number; total: number }>("/vendas", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] })
    },
  })
}

export function useCancelarVenda() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPatch<{ ok: boolean }>(`/vendas/${id}/cancelar`, {}),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] })
      queryClient.invalidateQueries({ queryKey: ["venda", variables.id] })
    },
  })
}
