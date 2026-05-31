"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Usuario } from "@/types"

interface AuthState {
  usuario: Usuario | null
  setUsuario: (usuario: Usuario) => void
  logout: () => Promise<void>
  isAuthenticated: () => boolean
}

// O token de sessão vive em cookie HttpOnly (setado pelo servidor no login).
// O JS NÃO tem acesso a ele — aqui guardamos apenas o `usuario` para a UI.
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usuario: null,
      setUsuario: (usuario) => set({ usuario }),
      logout: async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" })
        } catch {
          // ignora falha de rede no logout — o estado local é limpo de qualquer forma
        }
        set({ usuario: null })
      },
      isAuthenticated: () => !!get().usuario,
    }),
    { name: "brecho-auth" }
  )
)
