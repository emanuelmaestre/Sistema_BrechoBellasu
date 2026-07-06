// ══════════════════════════════════════════════════════════════════
// Classificação de respostas de consentimento LGPD (SIM/NÃO).
// Compartilhado entre o webhook Z-API e as rotas de admin que
// reprocessam o histórico de mensagens recebidas.
// ══════════════════════════════════════════════════════════════════

const SIM_WORDS = new Set(["sim", "s", "yes", "y", "quero", "aceito", "claro", "pode", "autorizo", "ok", "ta", "certo", "positivo"])
const NAO_WORDS = new Set(["nao", "n", "no", "nao quero", "recuso", "pare", "nao autorizo", "cancela", "cancelar", "negativo"])

// Remove emojis, pontuação e acentos para permitir comparação tolerante.
// Cobre tanto quem digita "não" solto quanto quem copia o texto do botão
// da mensagem original (ex: "❌ NÃO — Não autorizo").
export function normalizarResposta(texto: string): string {
  return texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")           // remove acentos
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/gu, "") // remove emojis
    .replace(/[^a-zA-Z\s]/g, " ")                       // remove pontuação/traços/símbolos
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/** Classifica a resposta como "sim" | "nao" | null (indefinida) */
export function classificarResposta(textoOriginal: string): "sim" | "nao" | null {
  const norm = normalizarResposta(textoOriginal)
  if (!norm) return null

  // Match exato primeiro (resposta curta e direta)
  if (SIM_WORDS.has(norm)) return "sim"
  if (NAO_WORDS.has(norm)) return "nao"

  // Contém o texto do botão da mensagem original, em qualquer lugar da frase
  // (ex: cliente cola "❌ NÃO — Não autorizo" ou escreve algo antes/depois)
  if (norm.includes("nao autorizo")) return "nao"
  if (norm.includes("sim autorizo")) return "sim"

  // Primeira palavra da frase é uma palavra-chave isolada
  const primeira = norm.split(" ")[0]
  if (SIM_WORDS.has(primeira)) return "sim"
  if (NAO_WORDS.has(primeira)) return "nao"

  return null
}
