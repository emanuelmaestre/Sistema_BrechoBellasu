"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Usuario } from "@/types"

interface AuthState {
  token: string | null
  usuario: Usuario | null
  setAuth: (token: string, usuario: Usuario) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      usuario: null,
      setAuth: (token, usuario) => {
        set({ token, usuario })
        // Salva cookie para o middleware SSR conseguir ler
        document.cookie = `brecho-token=${token};path=/;max-age=${60 * 60 * 24 * 7}`
      },
      logout: () => {
        set({ token: null, usuario: null })
        document.cookie = "brecho-token=;path=/;max-age=0"
      },
      isAuthenticated: () => !!get().token,
    }),
    { name: "brecho-auth" }
  )
)
