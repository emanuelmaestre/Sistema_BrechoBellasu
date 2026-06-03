import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost, apiPatch } from "@/services/api"
import type { Produto } from "@/types"

interface ProdutosParams {
  busca?: string
  categoria_id?: number
  marca?: string
  page?: number
}

interface ProdutosResponse {
  data: Produto[]
  total: number
}

export function useProdutos(params: ProdutosParams = {}) {
  const { data, isLoading, error, refetch } = useQuery<ProdutosResponse>({
    queryKey: ["produtos", params],
    queryFn: () =>
      apiGet<ProdutosResponse>("/produtos", params as Record<string, unknown>),
  })

  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
  }
}

export function useProduto(id: number) {
  const { data, isLoading, error } = useQuery<Produto>({
    queryKey: ["produto", id],
    queryFn: () => apiGet<Produto>(`/produtos/${id}`),
    enabled: !!id,
  })

  return {
    data: data ?? null,
    isLoading,
    error,
  }
}

export function useCreateProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Produto>) => apiPost<{ id: number }>("/produtos", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] })
    },
  })
}

export function useUpdateProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Produto> & { id: number }) =>
      apiPatch<Produto>(`/produtos/${id}`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] })
      queryClient.invalidateQueries({ queryKey: ["produto", variables.id] })
    },
  })
}

export function useAjustarEstoque() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      quantidade,
      tipo,
    }: {
      id: number
      quantidade: number
      tipo: "entrada" | "saida" | "ajuste"
    }) => apiPatch<Produto>(`/produtos/${id}/estoque`, { quantidade, tipo }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] })
      queryClient.invalidateQueries({ queryKey: ["produto", variables.id] })
    },
  })
}
