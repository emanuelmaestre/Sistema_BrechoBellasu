const CAMPANHA_TEXT_MAX = 800
const MIDIA_TIPOS = new Set(["imagem", "video"])
const MIDIA_NOME = /^campanha_[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp|gif|mp4|mov|webm)$/

export type MidiaCampanha = {
  midia_tipo: "imagem" | "video" | null
  midia_url: string | null
  midia_nome: string | null
}

export function parsePositiveInteger(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export function normalizeCampaignText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = value.trim()
  if (!text || text.length > CAMPANHA_TEXT_MAX) return null
  return text
}

export function normalizeCampaignMedia(
  input: { midia_tipo?: unknown; midia_url?: unknown; midia_nome?: unknown },
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
): MidiaCampanha | null {
  const empty = !input.midia_tipo && !input.midia_url && !input.midia_nome
  if (empty) {
    return { midia_tipo: null, midia_url: null, midia_nome: null }
  }

  if (
    typeof input.midia_tipo !== "string" ||
    !MIDIA_TIPOS.has(input.midia_tipo) ||
    typeof input.midia_url !== "string" ||
    typeof input.midia_nome !== "string" ||
    !MIDIA_NOME.test(input.midia_nome) ||
    !supabaseUrl
  ) {
    return null
  }

  try {
    const mediaUrl = new URL(input.midia_url)
    const projectUrl = new URL(supabaseUrl)
    const expectedPath = `/storage/v1/object/public/campanhas/${input.midia_nome}`

    if (
      mediaUrl.protocol !== "https:" ||
      mediaUrl.origin !== projectUrl.origin ||
      decodeURIComponent(mediaUrl.pathname) !== expectedPath
    ) {
      return null
    }
  } catch {
    return null
  }

  return {
    midia_tipo: input.midia_tipo as "imagem" | "video",
    midia_url: input.midia_url,
    midia_nome: input.midia_nome,
  }
}

export function detectAllowedMedia(buffer: Buffer): {
  mime: string
  extension: string
  type: "imagem" | "video"
} | null {
  if (buffer.length < 12) return null

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg", type: "imagem" }
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", extension: "png", type: "imagem" }
  }
  if (buffer.subarray(0, 4).toString("ascii") === "GIF8") {
    return { mime: "image/gif", extension: "gif", type: "imagem" }
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp", type: "imagem" }
  }
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii")
    const quickTime = brand === "qt  "
    return {
      mime: quickTime ? "video/quicktime" : "video/mp4",
      extension: quickTime ? "mov" : "mp4",
      type: "video",
    }
  }
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { mime: "video/webm", extension: "webm", type: "video" }
  }

  return null
}
