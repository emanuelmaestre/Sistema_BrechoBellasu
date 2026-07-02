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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="flex-1 overflow-y-auto px-3 sm:px-6 pb-3 sm:pb-6 min-w-0"
          style={{ background: "var(--bg-base)" }}
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <DisparoWidget />
    </div>
  )
}
