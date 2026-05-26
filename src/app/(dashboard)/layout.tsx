import { ThemeProvider } from "@/components/layout/ThemeProvider"
import { ConditionalLayout } from "@/components/layout/ConditionalLayout"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ConditionalLayout>{children}</ConditionalLayout>
    </ThemeProvider>
  )
}
