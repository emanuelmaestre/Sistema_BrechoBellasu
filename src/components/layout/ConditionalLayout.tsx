"use client"

import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { ModuleTopBar } from "./ModuleTopBar"

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMenu = pathname === "/menu"

  if (isMenu) {
    return (
      <div className="h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
        {children}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <ModuleTopBar />
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 overflow-y-auto p-3 sm:p-6 min-w-0"
          style={{ background: "var(--bg-base)" }}
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  )
}
