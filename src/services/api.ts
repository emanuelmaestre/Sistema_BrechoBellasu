// ══════════════════════════════════════
// API client — rotas internas do Next.js (/api/*)
// ══════════════════════════════════════
import axios from "axios"

// Em produção usa NEXT_PUBLIC_APP_URL; em dev usa URL relativa
const BASE_URL =
  typeof window !== "undefined"
    ? "/api"
    : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001") + "/api"

export const apiClient = axios.create({ baseURL: BASE_URL })

// Injeta token automaticamente
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    try {
      const auth = JSON.parse(localStorage.getItem("brecho-auth") || "{}")
      const token = auth?.state?.token
      if (token) config.headers.Authorization = `Bearer ${token}`
    } catch {}
  }
  return config
})

// Extrai mensagem real do erro da API em vez do genérico Axios
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const msg = error?.response?.data?.erro || error?.response?.data?.message || error?.message
    return Promise.reject(new Error(msg || "Erro desconhecido"))
  }
)

// Helpers tipados
export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await apiClient.get<T>(path, { params })
  return data
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.post<T>(path, body)
  return data
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.put<T>(path, body)
  return data
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.patch<T>(path, body)
  return data
}

export async function apiDelete<T>(path: string): Promise<T> {
  const { data } = await apiClient.delete<T>(path)
  return data
}
