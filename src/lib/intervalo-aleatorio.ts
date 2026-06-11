// ══════════════════════════════════════════════════════════════════
// Gerador de intervalo imprevisível (8s–40s) — função PURA, sem
// dependências de servidor. Pode ser importada com segurança tanto no
// cliente (orquestração do disparo no navegador) quanto no servidor.
// ══════════════════════════════════════════════════════════════════

/**
 * Retorna um intervalo em ms entre 8.000 e 40.000 com máxima
 * imprevisibilidade. Algoritmo em 3 camadas:
 *  1. Base aleatória via crypto (quando disponível) ou Math.random
 *  2. Ruído gaussiano aproximado (soma de 6 uniformes)
 *  3. Escolha aleatória entre 3 estratégias de distribuição
 *
 * O valor anterior garante um delta mínimo de 4s, evitando repetição
 * imediata do mesmo intervalo.
 */
export function gerarIntervaloAleatorio(anteriorMs?: number): number {
  const MIN = 8_000
  const MAX = 40_000
  const RANGE = MAX - MIN
  const DELTA_MIN = 4_000

  function rand(): number {
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      const buf = new Uint32Array(1)
      globalThis.crypto.getRandomValues(buf)
      return buf[0] / 0xFFFFFFFF
    }
    return Math.random()
  }

  function gaussianRand(): number {
    let sum = 0
    for (let i = 0; i < 6; i++) sum += rand()
    const normalizado = sum / 6
    return rand() > 0.5 ? normalizado : 1 - normalizado
  }

  let candidato: number
  let tentativas = 0
  do {
    const estrategia = Math.floor(rand() * 3)
    let base: number
    if (estrategia === 0) {
      base = gaussianRand()
    } else if (estrategia === 1) {
      base = rand() * 0.4 + rand() * 0.6
    } else {
      base = Math.sqrt(rand())
    }
    candidato = Math.round(MIN + base * RANGE)
    tentativas++
  } while (
    anteriorMs !== undefined &&
    Math.abs(candidato - anteriorMs) < DELTA_MIN &&
    tentativas < 8
  )

  return candidato
}
