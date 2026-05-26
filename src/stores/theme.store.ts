"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Theme = "dark" | "light" | "blue"

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => {
        set({ theme })
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", theme)
        }
      },
    }),
    { name: "brecho-theme" }
  )
)
