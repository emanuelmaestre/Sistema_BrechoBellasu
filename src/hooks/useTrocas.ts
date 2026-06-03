import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost, apiPatch } from "@/services/api"
import type { Troca } from "@/types"

interface TrocasParams {
  tipo?: string
  status?: string
  page?: number
}

interface TrocasResponse {
  data: Troca[]
  total: number
}

export function useTrocas(params: TrocasParams = {}) {
  const { data, isLoading, error, refetch } = useQuery<TrocasResponse>({
    queryKey: ["trocas", params],
    queryFn: () =>
      apiGet<TrocasResponse>("/trocas", params as Record<string, unknown>),
  })

  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
  }
}

export function useCreateTroca() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      tipo: "troca" | "devolucao"
      motivo?: string
      venda_id?: number | null
      cliente_id?: number | null
      cliente_nome?: string | null
      produto_id?: number | null
      nome_produto?: string | null
      quantidade?: number
      observacoes?: string | null
      status?: string
    }) => apiPost<{ id: number }>("/trocas", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trocas"] })
    },
  })
}

export function useAtualizarStatusTroca() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiPatch<Troca>(`/trocas/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trocas"] })
    },
  })
}
