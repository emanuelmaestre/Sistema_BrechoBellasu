// ══════════════════════════════════════════════════════════════════
// Z-API Client — serviço centralizado de envio de WhatsApp.
// Todas as funções são assíncronas e não travam a UI.
// Registra log de cada disparo na tabela whatsapp_log.
// ══════════════════════════════════════════════════════════════════
import { createServerClient } from "./supabase"

// Remove qualquer caractere fora do ASCII imprimível (evita
// "Cannot convert argument to a ByteString" quando o env var foi colado
// com aspas tipográficas, espaços invisíveis ou quebras de linha).
const limpaHeader = (s: string) => s.replace(/[^\x21-\x7E]/g, "")

const INSTANCE_ID   = () => limpaHeader(process.env.ZAPI_INSTANCE_ID   ?? "")
const TOKEN         = () => limpaHeader(process.env.ZAPI_TOKEN         ?? "")
const CLIENT_TOKEN  = () => limpaHeader(process.env.ZAPI_CLIENT_TOKEN  ?? "")
const BASE          = () => `https://api.z-api.io/instances/${INSTANCE_ID()}/token/${TOKEN()}`

// ── Tipos ────────────────────────────────────────────────────
export interface ZAPIResult {
  ok: boolean
  messageId?: string
  erro?: string
}

type LogTipo =
  | "recibo_venda"
  | "troca_aprovada"
  | "troca_recusada"
  | "alerta_financeiro"
  | "aviso_live"
  | "rastreio_envio"
  | "status_envio"
  | "consentimento_novidades"
  | "consentimento_lives"
  | "consentimento"
  | "teste_conexao"
  | "outro"

// ── Funções internas ─────────────────────────────────────────

async function registrarLog(
  telefone: string,
  tipo: LogTipo,
  mensagem: string,
  status: "enviado" | "erro",
  erro?: string,
  messageId?: string,
) {
  try {
    const sb = createServerClient()
    await sb.from("whatsapp_log").insert({
      telefone,
      tipo,
      mensagem: mensagem.substring(0, 1000),
      status,
      erro: erro?.substring(0, 500) ?? null,
      message_id: messageId ?? null,
    })
  } catch { /* não falha se log não gravar */ }
}

function formatarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, "")
  // Se não começa com 55, adiciona
  if (!digits.startsWith("55")) return `55${digits}`
  return digits
}

// ── API pública ──────────────────────────────────────────────

/** Envia mensagem de texto simples */
export async function enviarTexto(
  telefone: string,
  mensagem: string,
  tipo: LogTipo = "outro",
): Promise<ZAPIResult> {
  const phone = formatarTelefone(telefone)
  try {
    const res = await fetch(`${BASE()}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": CLIENT_TOKEN(),
      },
      body: JSON.stringify({ phone, message: mensagem }),
      signal: AbortSignal.timeout(15000),
    })
    const text = await res.text().catch(() => "")
    let json: Record<string, unknown> = {}
    try { json = JSON.parse(text) } catch {
      // Z-API retornou HTML (instância desconectada ou erro de servidor)
      const erro = res.status === 401 ? "Instância não autorizada. Verifique o token Z-API."
        : !res.ok ? `Instância Z-API indisponível (HTTP ${res.status}). Verifique se o WhatsApp está conectado.`
        : "Resposta inválida da Z-API. Verifique se a instância está conectada."
      await registrarLog(phone, tipo, mensagem, "erro", erro)
      return { ok: false, erro }
    }
    // Z-API pode retornar falha de duas formas:
    // 1. json.error presente (erro explícito)
    // 2. json.value === false (número sem WhatsApp, bloqueado, inválido)
    const erroMsg = (json.error || json.message) as string | undefined
    const ok = res.ok && !json.error && json.value !== false
    await registrarLog(phone, tipo, mensagem, ok ? "enviado" : "erro", erroMsg, json.messageId as string)
    return { ok, messageId: json.messageId as string, erro: erroMsg }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await registrarLog(phone, tipo, mensagem, "erro", msg)
    return { ok: false, erro: msg }
  }
}

/** Envia mensagem com link (documento/PDF) */
export async function enviarDocumento(
  telefone: string,
  documentUrl: string,
  documentName: string,
  caption: string,
  tipo: LogTipo = "outro",
): Promise<ZAPIResult> {
  const phone = formatarTelefone(telefone)
  try {
    const res = await fetch(`${BASE()}/send-document/${encodeURIComponent(documentUrl)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": CLIENT_TOKEN(),
      },
      body: JSON.stringify({
        phone,
        document: documentUrl,
        fileName: documentName,
        caption,
      }),
      signal: AbortSignal.timeout(20000),
    })
    const text = await res.text().catch(() => "")
    let json: Record<string, unknown> = {}
    try { json = JSON.parse(text) } catch {
      const erro = !res.ok ? `Instância Z-API indisponível (HTTP ${res.status}). Verifique se o WhatsApp está conectado.` : "Resposta inválida da Z-API."
      await registrarLog(phone, tipo, caption, "erro", erro)
      return { ok: false, erro }
    }
    const erroMsgDoc = (json.error || json.message) as string | undefined
    const ok = res.ok && !json.error && json.value !== false
    await registrarLog(phone, tipo, caption, ok ? "enviado" : "erro", erroMsgDoc, json.messageId as string)
    return { ok, messageId: json.messageId as string, erro: erroMsgDoc }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await registrarLog(phone, tipo, caption, "erro", msg)
    return { ok: false, erro: msg }
  }
}

/** Envia mensagem com link clicável */
export async function enviarLink(
  telefone: string,
  mensagem: string,
  linkUrl: string,
  titulo: string,
  tipo: LogTipo = "outro",
): Promise<ZAPIResult> {
  const phone = formatarTelefone(telefone)
  try {
    const res = await fetch(`${BASE()}/send-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": CLIENT_TOKEN(),
      },
      body: JSON.stringify({
        phone,
        message: mensagem,
        linkUrl,
        title: titulo,
        linkDescription: "",
      }),
      signal: AbortSignal.timeout(15000),
    })
    const text = await res.text().catch(() => "")
    let json: Record<string, unknown> = {}
    try { json = JSON.parse(text) } catch {
      const erro = !res.ok ? `Instância Z-API indisponível (HTTP ${res.status}). Verifique se o WhatsApp está conectado.` : "Resposta inválida da Z-API."
      await registrarLog(phone, tipo, mensagem, "erro", erro)
      return { ok: false, erro }
    }
    const erroMsgLink = (json.error || json.message) as string | undefined
    const ok = res.ok && !json.error && json.value !== false
    await registrarLog(phone, tipo, mensagem, ok ? "enviado" : "erro", erroMsgLink, json.messageId as string)
    return { ok, messageId: json.messageId as string, erro: erroMsgLink }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await registrarLog(phone, tipo, mensagem, "erro", msg)
    return { ok: false, erro: msg }
  }
}

/**
 * Verifica se o número possui WhatsApp ativo (endpoint phone-exists).
 * Em caso de falha na consulta, retorna existe=true para não bloquear
 * o envio por instabilidade da API (fail-open).
 */
export async function verificarNumeroExiste(telefone: string): Promise<{ existe: boolean; detalhe?: string }> {
  const phone = formatarTelefone(telefone)
  try {
    const res = await fetch(`${BASE()}/phone-exists/${phone}`, {
      headers: { "Client-Token": CLIENT_TOKEN() },
      signal: AbortSignal.timeout(10000),
    })
    const json = await res.json().catch(() => ({}))
    if (typeof json.exists === "boolean") {
      return { existe: json.exists, detalhe: json.exists ? undefined : "Número sem WhatsApp ativo" }
    }
    return { existe: true }
  } catch {
    return { existe: true }
  }
}

/** Testa conexão da instância Z-API */
export async function testarConexao(): Promise<{ conectado: boolean; detalhe: string }> {
  try {
    const res = await fetch(`${BASE()}/status`, {
      headers: { "Client-Token": CLIENT_TOKEN() },
      signal: AbortSignal.timeout(8000),
    })
    const json = await res.json().catch(() => ({}))
    const connected = json?.connected === true || json?.status === "connected" || json?.value === "CONNECTED"
    return { conectado: connected, detalhe: connected ? "Instância conectada" : (json?.message ?? json?.value ?? "Desconectado") }
  } catch (e) {
    return { conectado: false, detalhe: e instanceof Error ? e.message : "Erro de conexão" }
  }
}
