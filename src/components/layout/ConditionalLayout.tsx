"use client"

import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { ModuleTopBar } from "./ModuleTopBar"
import DisparoWidget from "@/components/live/DisparoWidget"

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMenu = pathname === "/menu"

  if (isMenu) {
    return (
      <div className="h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
        {children}
        <DisparoWidget />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <ModuleTopBar />
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, x: 28, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={{ opacity: 0, x: -28, y: -8, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, mass: 0.9 }}
          className="flex-1 overflow-y-auto px-3 sm:px-6 pt-3 sm:pt-6 pb-3 sm:pb-6 min-w-0"
          style={{ background: "var(--bg-base)" }}
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <DisparoWidget />
    </div>
  )
}
