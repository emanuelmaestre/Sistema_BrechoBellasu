/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Impede o browser de "adivinhar" o MIME type (anti MIME-sniffing)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Impede que o site seja embutido em iframe de terceiros (anti-clickjacking)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Não vaza a URL completa de origem para sites externos
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Força HTTPS por 2 anos (inclui subdomínios)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
]

const nextConfig = {
  serverExternalPackages: ["googleapis"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
