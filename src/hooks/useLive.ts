import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/services/api"
import type { Live } from "@/types"

export interface Compra {
  id: number
  live_id: number
  cliente_id?: number | null
  cliente_nome?: string | null
  quantidade_itens?: number
  total?: number | null
  forma_pagamento?: string | null
  status_compra?: string | null
  notificacao_status?: string | null
  total_produtos_vinculados?: number
  total_estoque_baixado?: number
  created_at: string
}

export interface LiveDetalhe extends Live {
  compras: Compra[]
}

interface LivesResponse {
  data: Live[]
  total: number
}

export function useLives() {
  const { data, isLoading, error, refetch } = useQuery<LivesResponse>({
    queryKey: ["lives"],
    queryFn: () => apiGet<LivesResponse>("/live"),
  })

  return {
    data: data?.data ?? [],
    isLoading,
    error,
    refetch,
  }
}

export function useLiveDetalhe(id: number) {
  const { data, isLoading, error, refetch } = useQuery<LiveDetalhe>({
    queryKey: ["live", id],
    queryFn: () => apiGet<LiveDetalhe>(`/live/${id}`),
    enabled: !!id,
  })

  return {
    data: data ?? null,
    isLoading,
    error,
    refetch,
  }
}

export function useCreateLive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      titulo?: string
      data_live: string
      plataforma?: string
      tipo?: "novidades" | "promocional"
      observacoes?: string | null
      link_live?: string | null
    }) => apiPost<Live>("/live", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lives"] })
    },
  })
}
