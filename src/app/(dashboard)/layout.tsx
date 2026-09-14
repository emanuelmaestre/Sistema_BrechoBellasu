import { ConditionalLayout } from "@/components/layout/ConditionalLayout"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <ConditionalLayout>{children}</ConditionalLayout>
}
