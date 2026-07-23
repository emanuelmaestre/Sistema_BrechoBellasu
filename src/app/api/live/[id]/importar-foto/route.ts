import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"
import { getClientIp, rateLimit } from "@/lib/rateLimit"
import livePhotoImport from "@/data/ai/live-photo-import.json"

const JSON_SCHEMA = livePhotoImport.responseFormat
const PROMPT = livePhotoImport.prompt


export const dynamic = "force-dynamic"
export const maxDuration = 60

// ─── Schema da extração (validação do que a IA devolve) ───
const Confianca = z.enum(["alta", "media", "baixa"])

const CompraExtraida = z.object({
  nome_cliente:     z.string().nullable(),
  whatsapp:         z.string().nullable(),
  instagram:        z.string().nullable(),
  numero_sacola:    z.string().nullable(),
  quantidade_itens: z.number().nullable(),
  valor_total:      z.number().nullable(),
  observacao:       z.string().nullable(),
  confianca: z.object({
    nome_cliente:     Confianca,
    whatsapp:         Confianca,
    instagram:        Confianca,
    numero_sacola:    Confianca,
    quantidade_itens: Confianca,
    valor_total:      Confianca,
  }),
})

const ExtracaoSchema = z.object({
  legivel: z.boolean(),
  motivo_ilegivel: z.string().nullable(),
  compras: z.array(CompraExtraida),
})

// ─── Matching com clientes cadastradas ────────────────────
interface ClienteRow {
  id: number
  nome: string
  celular: string | null
  instagram: string | null
  saldo_credito: number | null
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}
function digits(s: string): string {
  return s.replace(/\D/g, "")
}
function fonesIguais(a: string, b: string): boolean {
  const da = digits(a), db = digits(b)
  if (da.length < 8 || db.length < 8) return false
  return da.slice(-8) === db.slice(-8)
}

interface Sugestao {
  id: number
  nome: string
  celular: string | null
  instagram: string | null
  saldo_credito: number
  match: "exato" | "parecido"
}

function matchClientes(
  extraida: { nome_cliente: string | null; whatsapp: string | null; instagram: string | null },
  clientes: ClienteRow[],
): Sugestao[] {
  const out: Sugestao[] = []
  const toSug = (c: ClienteRow, match: "exato" | "parecido"): Sugestao => ({
    id: c.id, nome: c.nome, celular: c.celular, instagram: c.instagram,
    saldo_credito: Number(c.saldo_credito ?? 0), match,
  })

  // 1. Match 100%: WhatsApp ou Instagram idênticos
  if (extraida.whatsapp) {
    const c = clientes.find(c => c.celular && fonesIguais(c.celular, extraida.whatsapp!))
    if (c) return [toSug(c, "exato")]
  }
  if (extraida.instagram) {
    const ig = norm(extraida.instagram.replace(/^@/, ""))
    const c = clientes.find(c => c.instagram && norm(c.instagram.replace(/^@/, "")) === ig)
    if (c) return [toSug(c, "exato")]
  }

  // 2. Match por nome
  if (extraida.nome_cliente) {
    const nomeExt = norm(extraida.nome_cliente)
    const tokensExt = nomeExt.split(/\s+/).filter(t => t.length >= 2)
    if (tokensExt.length === 0) return out

    const scored = clientes.map(c => {
      const nomeCli = norm(c.nome)
      if (nomeCli === nomeExt) return { c, score: 1.01 }
      const tokensCli = nomeCli.split(/\s+/)
      const hits = tokensExt.filter(t => tokensCli.some(tc => tc.startsWith(t) || t.startsWith(tc))).length
      return { c, score: hits / tokensExt.length }
    }).filter(x => x.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    for (const { c, score } of scored) out.push(toSug(c, score > 1 ? "exato" : "parecido"))
  }
  return out
}

// ─── POST — analisa a foto e devolve compras para revisão ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  await params // live id não é necessário para a análise, apenas valida a rota

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { erro: "Leitura por foto não configurada. Adicione a OPENAI_API_KEY nas variáveis de ambiente." },
      { status: 503 },
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`live-importar-foto:${auth.id}:${ip}`, 12, 60 * 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { erro: `Muitas analises por foto. Tente novamente em ${rl.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    )
  }

  const body = await req.json().catch(() => ({})) as { imagem?: string }
  const dataUrl = body.imagem ?? ""
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/)
  if (!m) {
    return NextResponse.json({ erro: "Imagem inválida. Envie uma foto JPEG, PNG ou WebP." }, { status: 400 })
  }
  const base64 = m[2]

  if (base64.length > 6_000_000) {
    return NextResponse.json({ erro: "Imagem muito grande. Tente novamente." }, { status: 413 })
  }

  // ── Chama o GPT-4o (visão) com structured outputs ──
  let extracao: z.infer<typeof ExtracaoSchema>
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
        temperature: 0,
        max_tokens: 4000,
        response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        }],
      }),
      signal: AbortSignal.timeout(55000),
    })

    if (!res.ok) {
      const detalhe = await res.text().catch(() => "")
      console.error("[importar-foto] OpenAI erro:", res.status, detalhe.slice(0, 500))
      return NextResponse.json(
        { erro: "Não foi possível analisar a imagem agora. Tente novamente em instantes." },
        { status: 502 },
      )
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data?.choices?.[0]?.message?.content
    if (!raw) throw new Error("Resposta vazia da IA")
    extracao = ExtracaoSchema.parse(JSON.parse(raw))
  } catch (e) {
    console.error("[importar-foto] erro na análise:", e)
    return NextResponse.json(
      { erro: "Não foi possível analisar a imagem agora. Tente novamente em instantes." },
      { status: 502 },
    )
  }

  if (!extracao.legivel || extracao.compras.length === 0) {
    return NextResponse.json({
      legivel: false,
      motivo: extracao.motivo_ilegivel
        ?? "Não encontrei anotações de compras nesta imagem. Tente uma foto mais nítida e bem iluminada.",
      compras: [],
    })
  }

  // ── Matching com clientes cadastradas ──
  const sb = createServerClient()
  const { data: clientesRaw } = await sb
    .from("clientes")
    .select("id, nome, celular, instagram, saldo_credito")
    .order("nome")
  const clientes = (clientesRaw ?? []) as ClienteRow[]

  const compras = extracao.compras.map(c => ({
    ...c,
    sugestoes: matchClientes(c, clientes),
  }))

  return NextResponse.json({ legivel: true, motivo: null, compras })
}
