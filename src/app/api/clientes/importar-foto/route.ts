import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { withAuth } from "@/lib/with-auth";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import clientPhotoImport from "@/data/ai/client-photo-import.json";
import statesData from "@/data/address/states.json";
import { extractVisionJson } from "@/lib/openai-vision";
import {
  isValidCpfCnpj,
  isValidEmail,
  normalizeBirthDate,
  onlyDigits,
} from "@/lib/photo-import-validation";

const JSON_SCHEMA = clientPhotoImport.responseFormat;
const PROMPT = clientPhotoImport.prompt;
const NOME_PARA_SIGLA: Record<string, string> = statesData.nameToCode;
const SIGLAS_VALIDAS = new Set(Object.values(NOME_PARA_SIGLA));

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ─── Schema da extração (validação do que a IA devolve) ───
const Confianca = z.enum(["alta", "media", "baixa"]);

const CAMPOS_CONFIANCA = [
  "nome",
  "apelido",
  "cpf_cnpj",
  "data_nasc",
  "celular",
  "instagram",
  "email",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "estado",
] as const;

const ClienteExtraido = z.object({
  nome: z.string().nullable(),
  apelido: z.string().nullable(),
  cpf_cnpj: z.string().nullable(),
  data_nasc: z.string().nullable(),
  celular: z.string().nullable(),
  instagram: z.string().nullable(),
  email: z.string().nullable(),
  cep: z.string().nullable(),
  logradouro: z.string().nullable(),
  numero: z.string().nullable(),
  complemento: z.string().nullable(),
  bairro: z.string().nullable(),
  cidade: z.string().nullable(),
  estado: z.string().nullable(),
  observacao_leitura: z.string().nullable(),
  imagens_origem: z.array(z.number().int().min(1).max(4)).min(1),
  confianca: z.object(
    Object.fromEntries(CAMPOS_CONFIANCA.map((c) => [c, Confianca])) as Record<
      (typeof CAMPOS_CONFIANCA)[number],
      typeof Confianca
    >,
  ),
});

const ExtracaoSchema = z.object({
  legivel: z.boolean(),
  motivo_ilegivel: z.string().nullable(),
  clientes: z.array(ClienteExtraido),
});

function semAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function sanearCliente(
  c: z.infer<typeof ClienteExtraido>,
): z.infer<typeof ClienteExtraido> {
  const confianca = { ...c.confianca };
  const avisos: string[] = [];

  // Celular: só dígitos, remove código do país (55). Sem DDD → confiança baixa.
  let celular = onlyDigits(c.celular);
  if (celular && [12, 13].includes(celular.length) && celular.startsWith("55"))
    celular = celular.slice(2);
  if (celular && ![10, 11].includes(celular.length)) {
    confianca.celular = "baixa";
    avisos.push(
      "Telefone com quantidade incomum de dígitos; confira no print.",
    );
  }

  // Data: descarta datas impossíveis, futuras ou anteriores a 1900.
  const dataOriginal = c.data_nasc?.trim() || null;
  const dataNasc = normalizeBirthDate(dataOriginal);
  if (dataOriginal && !dataNasc) {
    avisos.push(
      `Data de nascimento lida como "${dataOriginal}" é inválida e foi deixada em branco.`,
    );
  }

  // CPF/CNPJ: confere também os dígitos verificadores.
  const cpf = onlyDigits(c.cpf_cnpj);
  if (cpf && !isValidCpfCnpj(cpf)) {
    confianca.cpf_cnpj = "baixa";
    avisos.push("CPF/CNPJ não passou na validação dos dígitos verificadores.");
  }

  // CEP: só dígitos; diferente de 8 → confiança baixa.
  const cep = onlyDigits(c.cep);
  if (cep && cep.length !== 8) {
    confianca.cep = "baixa";
    avisos.push("CEP incompleto ou com quantidade incorreta de dígitos.");
  }

  // Estado: converte nome por extenso em sigla; não reconhecido → confiança baixa.
  let estado = c.estado?.trim().toUpperCase() || null;
  if (estado && estado.length !== 2) {
    estado = NOME_PARA_SIGLA[semAcentos(estado)] ?? estado;
  }
  if (estado && !SIGLAS_VALIDAS.has(estado)) {
    confianca.estado = "baixa";
    avisos.push("Estado não reconhecido; confira a sigla.");
  }

  // Instagram: sem @, sem espaços, minúsculo (padrão de handle).
  const instagram = c.instagram
    ? c.instagram.trim().replace(/^@/, "").replace(/\s+/g, "").toLowerCase() ||
      null
    : null;

  const email = c.email?.trim().toLowerCase() || null;
  if (email && !isValidEmail(email)) {
    confianca.email = "baixa";
    avisos.push("E-mail com formato inválido; confira no print.");
  }

  const observacoes = [c.observacao_leitura?.trim(), ...avisos].filter(Boolean);

  return {
    ...c,
    nome: c.nome?.trim() || null,
    celular,
    data_nasc: dataNasc,
    cpf_cnpj: cpf,
    cep,
    estado,
    instagram,
    email,
    imagens_origem: [...new Set(c.imagens_origem)].sort((a, b) => a - b),
    observacao_leitura: observacoes.length ? observacoes.join(" • ") : null,
    confianca,
  };
}

// ─── Matching com clientes já cadastradas ─────────────────
interface ClienteRow {
  id: number;
  nome: string;
  celular: string | null;
  instagram: string | null;
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
function digits(s: string): string {
  return s.replace(/\D/g, "");
}
function fonesIguais(a: string, b: string): boolean {
  const da = digits(a),
    db = digits(b);
  if (da.length < 8 || db.length < 8) return false;
  return da.slice(-8) === db.slice(-8);
}

interface Sugestao {
  id: number;
  nome: string;
  celular: string | null;
  instagram: string | null;
  match: "exato" | "parecido";
}

function matchClientes(
  extraido: {
    nome: string | null;
    celular: string | null;
    instagram: string | null;
  },
  clientes: ClienteRow[],
): Sugestao[] {
  const out: Sugestao[] = [];
  const toSug = (c: ClienteRow, match: "exato" | "parecido"): Sugestao => ({
    id: c.id,
    nome: c.nome,
    celular: c.celular,
    instagram: c.instagram,
    match,
  });

  // 1. Match 100%: celular ou Instagram idênticos → já cadastrada
  if (extraido.celular) {
    const c = clientes.find(
      (c) => c.celular && fonesIguais(c.celular, extraido.celular!),
    );
    if (c) return [toSug(c, "exato")];
  }
  if (extraido.instagram) {
    const ig = norm(extraido.instagram.replace(/^@/, ""));
    const c = clientes.find(
      (c) => c.instagram && norm(c.instagram.replace(/^@/, "")) === ig,
    );
    if (c) return [toSug(c, "exato")];
  }

  // 2. Nome parecido → possível duplicidade
  if (extraido.nome) {
    const nomeExt = norm(extraido.nome);
    const tokensExt = nomeExt.split(/\s+/).filter((t) => t.length >= 2);
    if (tokensExt.length === 0) return out;

    const scored = clientes
      .map((c) => {
        const nomeCli = norm(c.nome);
        if (nomeCli === nomeExt) return { c, score: 1.01 };
        const tokensCli = nomeCli.split(/\s+/);
        const hits = tokensExt.filter((t) =>
          tokensCli.some((tc) => tc.startsWith(t) || t.startsWith(tc)),
        ).length;
        return { c, score: hits / tokensExt.length };
      })
      .filter((x) => x.score >= 0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    for (const { c, score } of scored)
      out.push(toSug(c, score > 1 ? "exato" : "parecido"));
  }
  return out;
}

// ─── POST — analisa os prints e devolve clientes para revisão ──
export const POST = withAuth(
  async (req: NextRequest, _ctx: unknown, auth: { id: number }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          erro: "Leitura por foto não configurada. Adicione a OPENAI_API_KEY nas variáveis de ambiente.",
        },
        { status: 503 },
      );
    }

    const ip = getClientIp(req);
    const rl = rateLimit(
      `clientes-importar-foto:${auth.id}:${ip}`,
      8,
      60 * 60_000,
    );
    if (!rl.ok) {
      return NextResponse.json(
        {
          erro: `Muitas analises por foto. Tente novamente em ${rl.retryAfter}s.`,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const body = (await req.json().catch(() => ({}))) as { imagens?: string[] };
    const imagens = Array.isArray(body.imagens) ? body.imagens : [];
    if (imagens.length === 0 || imagens.length > 4) {
      return NextResponse.json(
        { erro: "Envie de 1 a 4 prints por análise." },
        { status: 400 },
      );
    }

    let totalBase64 = 0;
    for (const dataUrl of imagens) {
      const m = dataUrl.match(
        /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/,
      );
      if (!m) {
        return NextResponse.json(
          { erro: "Imagem inválida. Envie prints JPEG, PNG ou WebP." },
          { status: 400 },
        );
      }
      totalBase64 += m[2].length;
    }
    if (totalBase64 > 12_000_000) {
      return NextResponse.json(
        { erro: "Imagens muito grandes. Tente novamente com menos prints." },
        { status: 413 },
      );
    }

    // ── Extração visual com schema estrito e validações brasileiras ──
    let extracao: z.infer<typeof ExtracaoSchema>;
    try {
      const raw = await extractVisionJson<unknown>({
        apiKey,
        prompt: PROMPT,
        images: imagens,
        responseFormat: JSON_SCHEMA,
        maxOutputTokens: 14_000,
        signal: AbortSignal.timeout(110_000),
      });
      extracao = ExtracaoSchema.parse(raw);
    } catch (e) {
      console.error("[clientes/importar-foto] erro na análise:", e);
      return NextResponse.json(
        {
          erro: "Não foi possível analisar os prints agora. Tente novamente em instantes.",
        },
        { status: 502 },
      );
    }

    if (!extracao.legivel || extracao.clientes.length === 0) {
      return NextResponse.json({
        legivel: false,
        motivo:
          extracao.motivo_ilegivel ??
          "Não encontrei dados cadastrais nestes prints. Tente capturas mais nítidas, mostrando os dados da cliente.",
        clientes: [],
      });
    }

    // ── Matching com clientes já cadastradas (evita duplicidade) ──
    const sb = createServerClient();
    const { data: clientesRaw } = await sb
      .from("clientes")
      .select("id, nome, celular, instagram")
      .order("nome");
    const cadastrados = (clientesRaw ?? []) as ClienteRow[];

    const clientes = extracao.clientes.map(sanearCliente).map((c) => ({
      ...c,
      sugestoes: matchClientes(c, cadastrados),
    }));

    return NextResponse.json({ legivel: true, motivo: null, clientes });
  },
);
