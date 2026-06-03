import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost, apiPatch } from "@/services/api"
import type { ContaPagar, ContaReceber } from "@/types"

export interface ResumoFinanceiro {
  receitas: number
  despesas: number
  saldo: number
  periodo?: string
}

interface ContasPagarResponse {
  data: ContaPagar[]
  total: number
  soma?: number
}

interface ContasReceberResponse {
  data: ContaReceber[]
  total: number
  soma?: number
}

interface FinanceiroParams {
  status?: string
  de?: string
  ate?: string
}

export function useContasPagar(params: FinanceiroParams = {}) {
  const { data, isLoading, error, refetch } = useQuery<ContasPagarResponse>({
    queryKey: ["contas-pagar", params],
    queryFn: () =>
      apiGet<ContasPagarResponse>("/financeiro/pagar", params as Record<string, unknown>),
  })

  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
  }
}

export function useContasReceber(params: FinanceiroParams = {}) {
  const { data, isLoading, error, refetch } = useQuery<ContasReceberResponse>({
    queryKey: ["contas-receber", params],
    queryFn: () =>
      apiGet<ContasReceberResponse>("/financeiro/receber", params as Record<string, unknown>),
  })

  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
  }
}

export function useResumoFinanceiro() {
  const { data, isLoading, error } = useQuery<ResumoFinanceiro>({
    queryKey: ["financeiro-resumo"],
    queryFn: () => apiGet<ResumoFinanceiro>("/financeiro/resumo"),
  })

  return {
    data: data ?? null,
    isLoading,
    error,
  }
}

export function usePagarConta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; data_pagamento?: string; valor_pago?: number }) =>
      apiPatch<ContaPagar>(`/financeiro/pagar/${id}/pagar`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas-pagar"] })
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo"] })
    },
  })
}

export function useReceberConta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; data_recebimento?: string; valor_recebido?: number }) =>
      apiPatch<ContaReceber>(`/financeiro/receber/${id}/receber`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas-receber"] })
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo"] })
    },
  })
}

export function useCreateContaPagar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { descricao: string; valor: number; vencimento: string; categoria?: string }) =>
      apiPost<{ id: number }>("/financeiro/pagar", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas-pagar"] })
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo"] })
    },
  })
}

export function useCreateContaReceber() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      descricao: string
      valor: number
      vencimento: string
      cliente_id?: number | null
    }) => apiPost<{ id: number }>("/financeiro/receber", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas-receber"] })
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo"] })
    },
  })
}
