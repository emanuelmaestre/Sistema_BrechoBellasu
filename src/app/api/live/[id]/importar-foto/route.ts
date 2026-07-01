import { NextRequest, NextResponse } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// ─── Schema da extração (o que o Claude devolve) ──────────
const Confianca = z.enum(["alta", "media", "baixa"])

const CompraExtraida = z.object({
  nome_cliente:     z.string().nullable().describe("Nome da cliente como está escrito"),
  whatsapp:         z.string().nullable().describe("Telefone/WhatsApp se anotado, apenas dígitos"),
  instagram:        z.string().nullable().describe("@ do Instagram se anotado, sem o @"),
  numero_sacola:    z.string().nullable().describe("Número da sacola"),
  cor_sacola:       z.string().nullable().describe("Cor da sacola, normalizada para a lista quando possível"),
  quantidade_itens: z.number().nullable().describe("Quantidade de itens/peças"),
  valor_total:      z.number().nullable().describe("Valor total em reais, ex: 150.50"),
  observacao:       z.string().nullable().describe("Qualquer anotação extra relevante desta compra"),
  confianca: z.object({
    nome_cliente:     Confianca,
    whatsapp:         Confianca,
    instagram:        Confianca,
    numero_sacola:    Confianca,
    cor_sacola:       Confianca,
    quantidade_itens: Confianca,
    valor_total:      Confianca,
  }).describe("Nível de confiança da leitura de cada campo"),
})

const ExtracaoSchema = z.object({
  legivel: z.boolean().describe("false se a imagem estiver ilegível, desfocada ou sem anotações de compras"),
  motivo_ilegivel: z.string().nullable().describe("Se legivel=false, explique o problema em uma frase curta e amigável"),
  compras: z.array(CompraExtraida).describe("Uma entrada por compra/cliente identificada na página"),
})

const PROMPT = `Você está lendo a foto de uma página de caderno onde a dona de um brechó anota, à mão, as compras das clientes durante uma live de vendas no Instagram.

Cada linha ou bloco de anotação geralmente representa UMA compra de UMA cliente e pode conter:
- Nome da cliente (às vezes apelido ou @ do Instagram)
- Número da sacola (ex: "sacola 12", "S12", "#12" ou só o número)
- Cor da sacola — cores usadas: AMARELO, AZUL, BRANCO, LARANJA, ROSA PINK, VERDE, VERDE ÁGUA
- Quantidade de itens/peças (ex: "3 pçs", "3x", "3 itens")
- Valor total (ex: "R$ 150", "150,00", "150")
- Telefone/WhatsApp
- Observações (ex: "vai retirar", "entregar", "pagou pix")

REGRAS:
1. Extraia TODAS as compras que conseguir identificar, uma por cliente/linha.
2. Se a cor da sacola for parecida com uma da lista, normalize para a grafia da lista (ex: "rosa" → "ROSA PINK", "verde agua" → "VERDE ÁGUA"). Se não bater com nenhuma, retorne como está escrito.
3. Valores em reais: converta para número (ex: "R$ 1.250,50" → 1250.50).
4. Telefone: retorne apenas os dígitos, com DDD se visível.
5. Instagram: retorne sem o "@".
6. NÃO invente dados. Campo não anotado ou impossível de ler = null.
7. Confiança por campo: "alta" = leitura clara e certa; "media" = legível mas com alguma dúvida (letra ambígua, número borrado); "baixa" = chute com base em rabisco quase ilegível. Campo null = "alta" (não há o que duvidar).
8. Se a página inteira estiver ilegível, desfocada, escura ou não contiver anotações de compras, retorne legivel=false com um motivo curto e amigável em português.
9. Ignore anotações riscadas/tachadas (compra cancelada).`

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
  // compara os últimos 8 dígitos (ignora DDD/9 extra)
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
      if (nomeCli === nomeExt) return { c, score: 1.01 } // nome completo idêntico
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { erro: "Leitura por foto não configurada. Adicione a ANTHROPIC_API_KEY nas variáveis de ambiente." },
      { status: 503 },
    )
  }

  const body = await req.json().catch(() => ({})) as { imagem?: string }
  const dataUrl = body.imagem ?? ""
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/)
  if (!m) {
    return NextResponse.json({ erro: "Imagem inválida. Envie uma foto JPEG, PNG ou WebP." }, { status: 400 })
  }
  const [, mediaType, base64] = m

  // ~4MB de base64 ≈ 3MB de imagem — acima disso o upload já deveria ter sido comprimido
  if (base64.length > 6_000_000) {
    return NextResponse.json({ erro: "Imagem muito grande. Tente novamente." }, { status: 413 })
  }

  // ── Chama o Claude Vision ──
  let extracao: z.infer<typeof ExtracaoSchema>
  try {
    const result = await generateObject({
      model: anthropic("claude-sonnet-5"),
      schema: ExtracaoSchema,
      maxOutputTokens: 8000,
      messages: [{
        role: "user",
        content: [
          { type: "image", image: base64, mediaType: mediaType as "image/jpeg" },
          { type: "text", text: PROMPT },
        ],
      }],
    })
    extracao = result.object
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
