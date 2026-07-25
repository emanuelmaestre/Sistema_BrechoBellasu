import broadcastData from "@/data/messages/broadcast.json"

const GREETINGS = broadcastData.greetings

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

let _pool: number[] = []
let _recent: number[] = []

function refill(excludeRecent: number[]): void {
  const all = Array.from({ length: GREETINGS.length }, (_, i) => i)
  _pool = shuffle(all.filter(i => !excludeRecent.includes(i)))
  if (_pool.length === 0) _pool = shuffle(all)
}

export function resetBroadcastHistory() { _pool = []; _recent = [] }

function pickIndex(): number {
  if (_pool.length === 0) refill(_recent.slice(-6))
  const recent = _recent.slice(-6)
  let candidates = _pool.filter(i => !recent.includes(i))
  if (candidates.length === 0) candidates = _pool
  const chosen = candidates[0]
  _pool = _pool.filter(i => i !== chosen)
  _recent.push(chosen)
  if (_recent.length > GREETINGS.length) _recent.shift()
  return chosen
}

export function buildBroadcastSmallTalk(nome: string | null): string {
  const idx = pickIndex()
  const g = GREETINGS[idx]
  const firstName = nome?.trim().split(/\s+/)[0] ?? null
  if (firstName && firstName.length > 1 && !/^\d+$/.test(firstName)) {
    return g.withName.replace("{nome}", firstName)
  }
  return g.withoutName
}

export function buildBroadcastMessage(nome: string | null, texto: string): string {
  const smallTalk = buildBroadcastSmallTalk(nome)
  return `${smallTalk}\n\n${texto}`
}
