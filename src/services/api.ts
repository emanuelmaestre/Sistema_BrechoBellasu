// ══════════════════════════════════════
// API client — aponta para o backend atual
// ══════════════════════════════════════
import axios from "axios"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://sistema-brecho-bellasu.vercel.app/api"

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
