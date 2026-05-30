// ─── Rate limiter simples em memória ──────────────────────
// Best-effort: em serverless cada instância tem seu próprio mapa,
// mas já protege contra rajadas de uma mesma instância.

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Limpa buckets expirados periodicamente para não vazar memória
let lastCleanup = Date.now()
function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key)
  }
}

/**
 * Verifica se a requisição está dentro do limite.
 * @param key identificador (ex: IP + rota)
 * @param max número máximo de requisições na janela
 * @param windowMs duração da janela em ms
 * @returns { ok, retryAfter } — retryAfter em segundos quando bloqueado
 */
export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  cleanup()
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  if (bucket.count >= max) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count++
  return { ok: true, retryAfter: 0 }
}

/** Extrai o IP do cliente a partir dos headers da requisição */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}
