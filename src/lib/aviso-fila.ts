// ══════════════════════════════════════════════════════════════════
// Ordenação da fila de disparo do AVISO de live.
//
// Regras (decididas com o usuário):
//  1. Bloco COMPRADORAS primeiro — clientes que já compraram em qualquer
//     live — embaralhado a cada disparo.
//  2. Bloco DEMAIS depois — opt-in que nunca comprou em live — embaralhado.
//  3. A 1ª cliente nunca repete a 1ª do disparo anterior (troca por outra
//     do MESMO bloco, para manter compradoras à frente).
//
// Função PURA e testável: recebe os dados prontos, não toca no banco. O
// embaralhamento usa Math.random por padrão; injetável para testes.
// ══════════════════════════════════════════════════════════════════

/** Embaralha uma cópia do array (Fisher-Yates). */
export function embaralhar<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Monta a ordem final do aviso: compradoras (embaralhadas) + demais
 * (embaralhadas), garantindo que a 1ª não seja a mesma do disparo anterior.
 */
export function ordenarFilaAviso<T extends { id: number }>(
  clientes: readonly T[],
  compradorasIds: Set<number>,
  ultimoPrimeiro: number | null,
  rng: () => number = Math.random,
): T[] {
  const blocoCompradoras = embaralhar(clientes.filter((c) => compradorasIds.has(c.id)), rng)
  const blocoDemais = embaralhar(clientes.filter((c) => !compradorasIds.has(c.id)), rng)
  const fila = [...blocoCompradoras, ...blocoDemais]

  // Se a 1ª repetiria, troca por outra do MESMO bloco que ocupa a posição 0.
  if (fila.length > 1 && ultimoPrimeiro != null && fila[0].id === ultimoPrimeiro) {
    const lo = 1
    const hi = blocoCompradoras.length > 0 ? blocoCompradoras.length : fila.length
    if (hi > lo) {
      const j = lo + Math.floor(rng() * (hi - lo))
      ;[fila[0], fila[j]] = [fila[j], fila[0]]
    }
  }

  return fila
}
