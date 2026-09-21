import type { Metadata, Viewport } from "next"
import { DM_Sans, DM_Mono, Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
})

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
})

// Inter é a fonte da ETIQUETA DE SACOLA, não da interface. A 203 dpi ela
// segura melhor o texto de 2,5 mm: aberturas largas que não fecham quando
// o calor da impressora térmica espalha. Auto-hospedada pelo next/font,
// então a etiqueta imprime igual mesmo sem internet.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Brechó Bellasu — Sistema de Gestão",
  description: "Sistema de gestão para o Brechó Bellasu",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Brechó Bellasu",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
}

// Sistema só tem tema escuro: pinta a barra do navegador/celular na cor do fundo.
export const viewport: Viewport = {
  themeColor: "#0a0f1e",
  colorScheme: "dark",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" className={`${dmSans.variable} ${dmMono.variable} ${inter.variable} h-full`}>
      <body className="font-sans antialiased min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
