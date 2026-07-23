import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"
import { getClientIp, rateLimit } from "@/lib/rateLimit"

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

// JSON Schema (formato do OpenAI structured outputs — strict)
const CONFIANCA_PROPS = Object.fromEntries(
  CAMPOS_CONFIANCA.map(c => [c, { type: "string", enum: ["alta", "media", "baixa"] }]),
)

const JSON_SCHEMA = {
  name: "extracao_cadastro_clientes",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["legivel", "motivo_ilegivel", "clientes"],
    properties: {
      legivel: { type: "boolean", description: "false se as imagens estiverem ilegíveis, desfocadas ou sem nenhum dado cadastral de cliente" },
      motivo_ilegivel: { type: ["string", "null"], description: "Se legivel=false, explique o problema em uma frase curta e amigável" },
      clientes: {
        type: "array",
        description: "Uma entrada por PESSOA identificada nos prints. Prints diferentes da MESMA pessoa geram UMA única entrada com os dados combinados.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["nome","apelido","cpf_cnpj","data_nasc","celular","instagram","email","cep","logradouro","numero","complemento","bairro","cidade","estado","observacao_leitura","confianca"],
          properties: {
            nome:        { type: ["string", "null"], description: "Nome completo da cliente" },
            apelido:     { type: ["string", "null"], description: "Apelido ou nome de exibição, se diferente do nome completo" },
            cpf_cnpj:    { type: ["string", "null"], description: "CPF ou CNPJ, apenas dígitos" },
            data_nasc:   { type: ["string", "null"], description: "Data de nascimento no formato YYYY-MM-DD" },
            celular:     { type: ["string", "null"], description: "Celular/WhatsApp, apenas dígitos com DDD (sem +55). Ex: 16991234567" },
            instagram:   { type: ["string", "null"], description: "Usuário do Instagram, sem o @" },
            email:       { type: ["string", "null"], description: "E-mail, se aparecer" },
            cep:         { type: ["string", "null"], description: "CEP, apenas dígitos (8)" },
            logradouro:  { type: ["string", "null"], description: "Rua/Avenida SEM o número. Ex: 'Rua das Flores'" },
            numero:      { type: ["string", "null"], description: "Número do endereço" },
            complemento: { type: ["string", "null"], description: "Apto, bloco, casa, fundos etc." },
            bairro:      { type: ["string", "null"], description: "Bairro" },
            cidade:      { type: ["string", "null"], description: "Cidade" },
            estado:      { type: ["string", "null"], description: "Sigla do estado com 2 letras (ex: SP)" },
            observacao_leitura: { type: ["string", "null"], description: "Alguma informação cadastral relevante que não coube nos campos, em uma frase curta" },
            confianca: {
              type: "object",
              additionalProperties: false,
              required: [...CAMPOS_CONFIANCA],
              properties: CONFIANCA_PROPS,
            },
          },
        },
      },
    },
  },
} as const

const PROMPT = `Você está lendo PRINTS (capturas de tela) enviados pela dona de um brechó. Os prints são de conversas de WhatsApp, perfis/DM do Instagram ou anotações, e contêm DADOS CADASTRAIS de clientes — nome, telefone, endereço, CPF, data de nascimento, e-mail, @ do Instagram.

Sua missão: extrair SOMENTE informações de cadastro e organizá-las nos campos corretos. Seja minucioso — varra CADA print inteiro (topo, mensagens, rodapé, bio) e não deixe passar nenhum dado cadastral visível.

ONDE OS DADOS COSTUMAM APARECER:
- Topo da conversa/perfil do WhatsApp: nome do contato e, na tela "Dados do contato", o número de telefone e o recado/status.
- Perfil do Instagram: o @ (usuário) no título, o nome de exibição e a bio (que às vezes traz cidade e WhatsApp).
- Mensagens onde a cliente digita os próprios dados ("meu endereço é...", "CPF: ...", "CEP ...", "meu insta é...").
- Cartões de contato compartilhados na conversa (nome + número).
- Uma foto/print encaminhado DENTRO da conversa (ex: print de um comprovante com endereço).

REGRAS:
1. UMA entrada por PESSOA. Se vários prints forem claramente da MESMA pessoa (mesmo nome/telefone/@), combine tudo em UMA entrada só. Se houver pessoas diferentes, crie uma entrada para cada.
2. IGNORE todo o resto da conversa: preços, produtos, pagamentos, saudações, horários das mensagens, mensagens da LOJA. Extraia apenas dado cadastral DA CLIENTE.
3. NOME: prefira SEMPRE o nome que a própria cliente escreveu/assinou em mensagem, pois o nome salvo no contato do WhatsApp pode ser um apelido criado pela loja (ex: "Maria Live Sexta", "Cliente Ju"). Se só existir o nome do contato e ele parecer conter etiquetas da loja, extraia apenas a parte que é nome de pessoa e marque confiança "media". Remova emojis, símbolos e decorações do nome (ex: "✨ Ana Paula 🌸" → "Ana Paula").
4. ENDEREÇO: separe nos componentes corretos — logradouro (sem número), numero, complemento, bairro, cidade, estado (sigla 2 letras), cep (8 dígitos). Se a cliente escreveu tudo junto ("Rua das Flores 123 apto 4 Centro Araraquara SP 14800-000"), distribua cada parte no campo certo. Se a cidade aparecer sem estado e você tiver certeza razoável do estado pelo DDD do telefone ou pelo contexto, preencha com confiança "media"; caso contrário deixe null. Cidade citada na bio do Instagram pode ser usada com confiança "media".
5. TELEFONE: apenas dígitos, com DDD, sem o +55 (código do país). Se aparecer "+55 16 99134-7476", retorne "16991347476". O número exibido pelo WhatsApp no topo do perfil é confiável. Se a cliente digitou um número SEM DDD (8-9 dígitos), retorne os dígitos como estão e marque confiança "baixa" — nunca invente o DDD. Se houver dois números (fixo e celular), prefira o celular (começa com 9).
6. DATA DE NASCIMENTO: converta para YYYY-MM-DD ("15/03/1990" → "1990-03-15"). Só preencha se for claramente data de NASCIMENTO — nunca use datas de mensagens ou de entrega.
7. CPF/CNPJ: apenas dígitos. Só preencha se for claramente um CPF/CNPJ (11 ou 14 dígitos) — não confunda com telefone ou CEP.
8. INSTAGRAM: sem o @, em minúsculas. Nome de exibição do perfil não é o usuário — o usuário é o que aparece no título do perfil, na URL ou após um @.
9. APELIDO: só se houver um nome curto/informal claramente distinto do nome completo (ex: nome completo "Maria Aparecida Silva" e ela assina "Cida").
10. NÃO INVENTE NADA. Campo não visível nos prints = null. NUNCA complete um dado parcial com suposição (ex: não invente dígitos que faltam num telefone nem o número da casa que não aparece).
11. Confiança por campo: "alta" = leitura clara e certa; "media" = legível mas com dúvida (corte na imagem, abreviação ambígua, dado deduzido do contexto); "baixa" = quase ilegível ou incompleto. Campo null = "alta".
12. Se sobrar alguma informação cadastral relevante que não coube nos campos (ex: ponto de referência da entrega, segundo telefone), resuma em observacao_leitura.
13. Se as imagens não contiverem NENHUM dado cadastral (ou estiverem ilegíveis), retorne legivel=false com um motivo curto e amigável em português.

Responda SOMENTE com o JSON no formato solicitado.`

// ─── Saneamento pós-IA ────────────────────────────────────
// Defesa em profundidade: mesmo que a IA desobedeça o formato pedido,
// os dados chegam limpos na tela de revisão (telefone sem +55, data
// ISO, estado em sigla, CPF/CEP só dígitos). O que não der para
// corrigir com segurança é mantido e rebaixado para confiança "baixa".
const NOME_PARA_SIGLA: Record<string, string> = {
  "ACRE":"AC","ALAGOAS":"AL","AMAPA":"AP","AMAZONAS":"AM","BAHIA":"BA","CEARA":"CE",
  "DISTRITO FEDERAL":"DF","ESPIRITO SANTO":"ES","GOIAS":"GO","MARANHAO":"MA",
  "MATO GROSSO":"MT","MATO GROSSO DO SUL":"MS","MINAS GERAIS":"MG","PARA":"PA",
  "PARAIBA":"PB","PARANA":"PR","PERNAMBUCO":"PE","PIAUI":"PI","RIO DE JANEIRO":"RJ",
  "RIO GRANDE DO NORTE":"RN","RIO GRANDE DO SUL":"RS","RONDONIA":"RO","RORAIMA":"RR",
  "SANTA CATARINA":"SC","SAO PAULO":"SP","SERGIPE":"SE","TOCANTINS":"TO",
}

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
