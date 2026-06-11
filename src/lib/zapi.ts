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

/**
 * Resolve o número real do WhatsApp antes de enviar.
 *
 * O endpoint /phone-exists do Z-API faz duas coisas essenciais:
 *  1. Diz se o número possui WhatsApp ativo (exists: true/false)
 *  2. Devolve o número NORMALIZADO (phone) — corrige o 9º dígito faltante,
 *     que o /send-text NÃO corrige sozinho.
 *
 * Sem isso, números mal formatados eram "enviados" com sucesso (messageId)
 * mas nunca entregues, fazendo o sistema marcar "enviada" falsamente.
 *
 * - exists:true  → retorna { ok:true, phone: <normalizado> }
 * - exists:false → retorna { ok:false } (número inválido / sem WhatsApp)
 * - falha de rede → fail-open: { ok:true, phone: <bruto> } para não travar envios
 */
async function resolverNumeroWhatsApp(telefone: string): Promise<{ ok: boolean; phone: string; erro?: string }> {
  const bruto = formatarTelefone(telefone)
  try {
    const res = await fetch(`${BASE()}/phone-exists/${bruto}`, {
      headers: { "Client-Token": CLIENT_TOKEN() },
      signal: AbortSignal.timeout(10000),
    })
    const json = await res.json().catch(() => ({})) as { exists?: boolean; phone?: string | null }
    if (json.exists === true && typeof json.phone === "string" && json.phone) {
      return { ok: true, phone: json.phone.replace(/\D/g, "") }
    }
    if (json.exists === false) {
      return { ok: false, phone: bruto, erro: "Número sem WhatsApp ativo ou mal formatado — verifique o cadastro" }
    }
    // Resposta inesperada → não bloqueia, usa número bruto
    return { ok: true, phone: bruto }
  } catch {
    // Instabilidade de rede não deve impedir o envio
    return { ok: true, phone: bruto }
  }
}

// ── API pública ──────────────────────────────────────────────

/** Envia mensagem de texto simples */
export async function enviarTexto(
  telefone: string,
  mensagem: string,
  tipo: LogTipo = "outro",
): Promise<ZAPIResult> {
  // Resolve o número real (valida existência + corrige 9º dígito) antes de enviar
  const resolvido = await resolverNumeroWhatsApp(telefone)
  if (!resolvido.ok) {
    await registrarLog(resolvido.phone, tipo, mensagem, "erro", resolvido.erro)
    return { ok: false, erro: resolvido.erro }
  }
  const phone = resolvido.phone
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
  const resolvido = await resolverNumeroWhatsApp(telefone)
  if (!resolvido.ok) {
    await registrarLog(resolvido.phone, tipo, caption, "erro", resolvido.erro)
    return { ok: false, erro: resolvido.erro }
  }
  const phone = resolvido.phone
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
  const resolvido = await resolverNumeroWhatsApp(telefone)
  if (!resolvido.ok) {
    await registrarLog(resolvido.phone, tipo, mensagem, "erro", resolvido.erro)
    return { ok: false, erro: resolvido.erro }
  }
  const phone = resolvido.phone
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
