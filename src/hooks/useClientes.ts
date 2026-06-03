import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost, apiPatch } from "@/services/api"
import type { Cliente } from "@/types"

interface ClientesParams {
  busca?: string
  status?: string
  page?: number
  limit?: number
}

interface ClientesResponse {
  data: Cliente[]
  total: number
}

export function useClientes(params: ClientesParams = {}) {
  const { data, isLoading, error, refetch } = useQuery<ClientesResponse>({
    queryKey: ["clientes", params],
    queryFn: () =>
      apiGet<ClientesResponse>("/clientes", params as Record<string, unknown>),
  })

  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
  }
}

export function useCliente(id: number) {
  const { data, isLoading, error, refetch } = useQuery<Cliente>({
    queryKey: ["cliente", id],
    queryFn: () => apiGet<Cliente>(`/clientes/${id}`),
    enabled: !!id,
  })

  return {
    data: data ?? null,
    isLoading,
    error,
    refetch,
  }
}

export function useCreateCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Cliente>) => apiPost<{ id: number }>("/clientes", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
    },
  })
}

export function useUpdateCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Cliente> & { id: number }) =>
      apiPatch<Cliente>(`/clientes/${id}`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
      queryClient.invalidateQueries({ queryKey: ["cliente", variables.id] })
    },
  })
}

export function useToggleClienteStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      apiPatch<Cliente>(`/clientes/${id}/status`, { ativo }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
      queryClient.invalidateQueries({ queryKey: ["cliente", variables.id] })
    },
  })
}
