type JsonSchemaFormat = {
  name: string;
  strict: boolean;
  schema: Record<string, unknown>;
};

type VisionExtractionOptions = {
  apiKey: string;
  prompt: string;
  images: string[];
  responseFormat: JsonSchemaFormat;
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  status?: string;
  incomplete_details?: { reason?: string } | null;
};

/**
 * Executa uma extração visual conservadora usando a Responses API.
 * A saída é obrigada a respeitar o JSON Schema; validação de domínio
 * continua sendo responsabilidade da rota que conhece os dados.
 */
export async function extractVisionJson<T>({
  apiKey,
  prompt,
  images,
  responseFormat,
  maxOutputTokens = 10_000,
  signal,
}: VisionExtractionOptions): Promise<T> {
  const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-5.5";
  const isReasoningModel = /^gpt-5(?:\.|-|$)/.test(model) || /^o\d/.test(model);

  const body = {
    model,
    store: false,
    instructions: prompt,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Leia as imagens na ordem em que foram enviadas. Faça uma segunda varredura visual antes de responder e retorne somente os dados comprovados pelas imagens.",
          },
          ...images.flatMap((image_url, index) => [
            { type: "input_text", text: `IMAGEM ${index + 1}:` },
            { type: "input_image", image_url, detail: "high" },
          ]),
        ],
      },
    ],
    text: {
      ...(isReasoningModel ? { verbosity: "low" } : {}),
      format: {
        type: "json_schema",
        name: responseFormat.name,
        strict: responseFormat.strict,
        schema: responseFormat.schema,
      },
    },
    max_output_tokens: maxOutputTokens,
    ...(isReasoningModel ? { reasoning: { effort: "medium" } } : {}),
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as OpenAIResponse;
  const raw =
    data.output_text ??
    data.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text" && content.text)?.text;

  if (!raw) {
    const reason =
      data.incomplete_details?.reason ?? data.status ?? "resposta vazia";
    throw new Error(`Extração visual incompleta: ${reason}`);
  }

  return JSON.parse(raw) as T;
}
