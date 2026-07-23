import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { getClientIp, rateLimit } from "@/lib/rateLimit"
import clientPhotoImport from "@/data/ai/client-photo-import.json"
import statesData from "@/data/address/states.json"

const JSON_SCHEMA = clientPhotoImport.responseFormat
const PROMPT = clientPhotoImport.prompt
const NOME_PARA_SIGLA: Record<string, string> = statesData.nameToCode


export const dynamic = "force-dynamic"
export const maxDuration = 60

// ─── Schema da extração (validação do que a IA devolve) ───
const Confianca = z.enum(["alta", "media", "baixa"])

const CAMPOS_CONFIANCA = [
  "nome", "apelido", "cpf_cnpj", "data_nasc", "celular", "instagram", "email",
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "estado",
] as const

const ClienteExtraido = z.object({
  nome:        z.string().nullable(),
  apelido:     z.string().nullable(),
  cpf_cnpj:    z.string().nullable(),
  data_nasc:   z.string().nullable(),
  celular:     z.string().nullable(),
  instagram:   z.string().nullable(),
  email:       z.string().nullable(),
  cep:         z.string().nullable(),
  logradouro:  z.string().nullable(),
  numero:      z.string().nullable(),
  complemento: z.string().nullable(),
  bairro:      z.string().nullable(),
  cidade:      z.string().nullable(),
  estado:      z.string().nullable(),
  observacao_leitura: z.string().nullable(),
  confianca: z.object(Object.fromEntries(CAMPOS_CONFIANCA.map(c => [c, Confianca])) as Record<(typeof CAMPOS_CONFIANCA)[number], typeof Confianca>),
})

const ExtracaoSchema = z.object({
  legivel: z.boolean(),
  motivo_ilegivel: z.string().nullable(),
  clientes: z.array(ClienteExtraido),
})

function semAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
}

function sanearCliente(c: z.infer<typeof ClienteExtraido>): z.infer<typeof ClienteExtraido> {
  const soDigitos = (v: string | null) => v ? v.replace(/\D/g, "") || null : null
  const confianca = { ...c.confianca }

  // Celular: só dígitos, remove código do país (55). Sem DDD → confiança baixa.
  let celular = soDigitos(c.celular)
  if (celular && celular.length >= 12 && celular.startsWith("55")) celular = celular.slice(2)
  if (celular && celular.length < 10) confianca.celular = "baixa"

  // Data de nascimento: aceita DD/MM/AAAA e converte; formato irreconhecível → descarta.
  let dataNasc = c.data_nasc?.trim() || null
  if (dataNasc) {
    const br = dataNasc.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
    if (br) dataNasc = `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataNasc)) dataNasc = null
  }

  // CPF/CNPJ: só dígitos; tamanho estranho → mantém para revisão, confiança baixa.
  const cpf = soDigitos(c.cpf_cnpj)
  if (cpf && cpf.length !== 11 && cpf.length !== 14) confianca.cpf_cnpj = "baixa"

  // CEP: só dígitos; diferente de 8 → confiança baixa.
  const cep = soDigitos(c.cep)
  if (cep && cep.length !== 8) confianca.cep = "baixa"

  // Estado: converte nome por extenso em sigla; não reconhecido → confiança baixa.
  let estado = c.estado?.trim().toUpperCase() || null
  if (estado && estado.length !== 2) {
    estado = NOME_PARA_SIGLA[semAcentos(estado)] ?? estado
    if (estado.length !== 2) confianca.estado = "baixa"
  }

  // Instagram: sem @, sem espaços, minúsculo (padrão de handle).
  const instagram = c.instagram
    ? c.instagram.trim().replace(/^@/, "").replace(/\s+/g, "").toLowerCase() || null
    : null

  return { ...c, celular, data_nasc: dataNasc, cpf_cnpj: cpf, cep, estado, instagram, confianca }
}

// ─── Matching com clientes já cadastradas ─────────────────
interface ClienteRow {
  id: number
  nome: string
  celular: string | null
  instagram: string | null
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
  match: "exato" | "parecido"
}

function matchClientes(
  extraido: { nome: string | null; celular: string | null; instagram: string | null },
  clientes: ClienteRow[],
): Sugestao[] {
  const out: Sugestao[] = []
  const toSug = (c: ClienteRow, match: "exato" | "parecido"): Sugestao => ({
    id: c.id, nome: c.nome, celular: c.celular, instagram: c.instagram, match,
  })

  // 1. Match 100%: celular ou Instagram idênticos → já cadastrada
  if (extraido.celular) {
    const c = clientes.find(c => c.celular && fonesIguais(c.celular, extraido.celular!))
    if (c) return [toSug(c, "exato")]
  }
  if (extraido.instagram) {
    const ig = norm(extraido.instagram.replace(/^@/, ""))
    const c = clientes.find(c => c.instagram && norm(c.instagram.replace(/^@/, "")) === ig)
    if (c) return [toSug(c, "exato")]
  }

  // 2. Nome parecido → possível duplicidade
  if (extraido.nome) {
    const nomeExt = norm(extraido.nome)
    const tokensExt = nomeExt.split(/\s+/).filter(t => t.length >= 2)
    if (tokensExt.length === 0) return out

    const scored = clientes.map(c => {
      const nomeCli = norm(c.nome)
      if (nomeCli === nomeExt) return { c, score: 1.01 }
      const tokensCli = nomeCli.split(/\s+/)
      const hits = tokensExt.filter(t => tokensCli.some(tc => tc.startsWith(t) || t.startsWith(tc))).length
      return { c, score: hits / tokensExt.length }
    }).filter(x => x.score >= 0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    for (const { c, score } of scored) out.push(toSug(c, score > 1 ? "exato" : "parecido"))
  }
  return out
}

// ─── POST — analisa os prints e devolve clientes para revisão ──
export const POST = withAuth(async (req: NextRequest, _ctx: unknown, auth: { id: number }) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { erro: "Leitura por foto não configurada. Adicione a OPENAI_API_KEY nas variáveis de ambiente." },
      { status: 503 },
    )
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`clientes-importar-foto:${auth.id}:${ip}`, 8, 60 * 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { erro: `Muitas analises por foto. Tente novamente em ${rl.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    )
  }

  const body = await req.json().catch(() => ({})) as { imagens?: string[] }
  const imagens = Array.isArray(body.imagens) ? body.imagens : []
  if (imagens.length === 0 || imagens.length > 4) {
    return NextResponse.json({ erro: "Envie de 1 a 4 prints por análise." }, { status: 400 })
  }

  let totalBase64 = 0
  for (const dataUrl of imagens) {
    const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/)
    if (!m) {
      return NextResponse.json({ erro: "Imagem inválida. Envie prints JPEG, PNG ou WebP." }, { status: 400 })
    }
    totalBase64 += m[2].length
  }
  if (totalBase64 > 12_000_000) {
    return NextResponse.json({ erro: "Imagens muito grandes. Tente novamente com menos prints." }, { status: 413 })
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
            ...imagens.map(url => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } })),
          ],
        }],
      }),
      signal: AbortSignal.timeout(55000),
    })

    if (!res.ok) {
      const detalhe = await res.text().catch(() => "")
      console.error("[clientes/importar-foto] OpenAI erro:", res.status, detalhe.slice(0, 500))
      return NextResponse.json(
        { erro: "Não foi possível analisar os prints agora. Tente novamente em instantes." },
        { status: 502 },
      )
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data?.choices?.[0]?.message?.content
    if (!raw) throw new Error("Resposta vazia da IA")
    extracao = ExtracaoSchema.parse(JSON.parse(raw))
  } catch (e) {
    console.error("[clientes/importar-foto] erro na análise:", e)
    return NextResponse.json(
      { erro: "Não foi possível analisar os prints agora. Tente novamente em instantes." },
      { status: 502 },
    )
  }

  if (!extracao.legivel || extracao.clientes.length === 0) {
    return NextResponse.json({
      legivel: false,
      motivo: extracao.motivo_ilegivel
        ?? "Não encontrei dados cadastrais nestes prints. Tente capturas mais nítidas, mostrando os dados da cliente.",
      clientes: [],
    })
  }

  // ── Matching com clientes já cadastradas (evita duplicidade) ──
  const sb = createServerClient()
  const { data: clientesRaw } = await sb
    .from("clientes")
    .select("id, nome, celular, instagram")
    .order("nome")
  const cadastrados = (clientesRaw ?? []) as ClienteRow[]

  const clientes = extracao.clientes.map(sanearCliente).map(c => ({
    ...c,
    sugestoes: matchClientes(c, cadastrados),
  }))

  return NextResponse.json({ legivel: true, motivo: null, clientes })
})
