import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export interface IntegracaoStatus {
  id: string
  nome: string
  descricao: string
  conectado: boolean
  configurado: boolean
  detalhe?: string
  latencia?: number
}

async function checkSupabase(): Promise<IntegracaoStatus> {
  const t0 = Date.now()
  try {
    const sb = createServerClient()
    const { error } = await sb.from("configuracoes").select("id").limit(1)
    return {
      id: "supabase", nome: "Supabase", descricao: "Banco de dados e autenticação",
      conectado: !error, configurado: true,
      detalhe: error ? error.message : "Banco operacional",
      latencia: Date.now() - t0,
    }
  } catch (e) {
    return { id: "supabase", nome: "Supabase", descricao: "Banco de dados e autenticação", conectado: false, configurado: true, detalhe: String(e) }
  }
}

async function checkMelhorEnvio(): Promise<IntegracaoStatus> {
  const token = process.env.MELHOR_ENVIO_TOKEN ?? process.env.ME_TOKEN ?? ""
  if (!token) return { id: "melhorenvio", nome: "Melhor Envio", descricao: "Cálculo de fretes e etiquetas", conectado: false, configurado: false, detalhe: "Token não configurado" }
  const t0 = Date.now()
  try {
    const base = process.env.MELHOR_ENVIO_ENV === "sandbox"
      ? "https://sandbox.melhorenvio.com.br/api/v2"
      : "https://melhorenvio.com.br/api/v2"
    const res = await fetch(`${base}/me/balance`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "Brecho Bellasu (bellasu.brecho@gmail.com)", Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })
    return {
      id: "melhorenvio", nome: "Melhor Envio", descricao: "Cálculo de fretes e etiquetas",
      conectado: res.ok, configurado: true,
      detalhe: res.ok ? "Conta ativa" : `HTTP ${res.status}`,
      latencia: Date.now() - t0,
    }
  } catch {
    return { id: "melhorenvio", nome: "Melhor Envio", descricao: "Cálculo de fretes e etiquetas", conectado: false, configurado: true, detalhe: "Timeout ou erro de rede" }
  }
}

async function checkZApi(): Promise<IntegracaoStatus> {
  const instanceId   = process.env.ZAPI_INSTANCE_ID   ?? ""
  const instanceToken = process.env.ZAPI_TOKEN         ?? ""
  const clientToken  = process.env.ZAPI_CLIENT_TOKEN   ?? ""
  if (!instanceId || !instanceToken) return { id: "zapi", nome: "Z-API (WhatsApp)", descricao: "Envio de mensagens WhatsApp", conectado: false, configurado: false, detalhe: "Instância ou token não configurados" }
  const t0 = Date.now()
  try {
    const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/status`, {
      headers: { "Client-Token": clientToken },
      signal: AbortSignal.timeout(8000),
    })
    const json = await res.json().catch(() => ({}))
    const connected = json?.connected === true || json?.status === "connected" || json?.value === "CONNECTED"
    return {
      id: "zapi", nome: "Z-API (WhatsApp)", descricao: "Envio de mensagens WhatsApp",
      conectado: res.ok && connected, configurado: true,
      detalhe: connected ? "Instância conectada" : (json?.message ?? json?.value ?? `HTTP ${res.status}`),
      latencia: Date.now() - t0,
    }
  } catch {
    return { id: "zapi", nome: "Z-API (WhatsApp)", descricao: "Envio de mensagens WhatsApp", conectado: false, configurado: true, detalhe: "Timeout ou erro de rede" }
  }
}

async function checkAsaas(): Promise<IntegracaoStatus> {
  const token = process.env.ASAAS_TOKEN ?? ""
  if (!token) return { id: "asaas", nome: "Asaas", descricao: "Cobranças e pagamentos online", conectado: false, configurado: false, detalhe: "Token não configurado" }
  const t0 = Date.now()
  try {
    const base = process.env.ASAAS_URL ?? "https://api.asaas.com/v3"
    const res = await fetch(`${base}/myAccount`, {
      headers: { access_token: token, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })
    return {
      id: "asaas", nome: "Asaas", descricao: "Cobranças e pagamentos online",
      conectado: res.ok, configurado: true,
      detalhe: res.ok ? "Conta ativa" : `HTTP ${res.status}`,
      latencia: Date.now() - t0,
    }
  } catch {
    return { id: "asaas", nome: "Asaas", descricao: "Cobranças e pagamentos online", conectado: false, configurado: true, detalhe: "Timeout ou erro de rede" }
  }
}

async function checkResend(): Promise<IntegracaoStatus> {
  const token = process.env.RESEND_API_KEY ?? ""
  if (!token) return { id: "resend", nome: "Resend", descricao: "Envio de e-mails transacionais", conectado: false, configurado: false, detalhe: "Chave de API não configurada" }
  const t0 = Date.now()
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })
    return {
      id: "resend", nome: "Resend", descricao: "Envio de e-mails transacionais",
      conectado: res.ok, configurado: true,
      detalhe: res.ok ? "API ativa" : `HTTP ${res.status}`,
      latencia: Date.now() - t0,
    }
  } catch {
    return { id: "resend", nome: "Resend", descricao: "Envio de e-mails transacionais", conectado: false, configurado: true, detalhe: "Timeout ou erro de rede" }
  }
}

async function checkOpenAI(): Promise<IntegracaoStatus> {
  const token = process.env.OPENAI_API_KEY ?? ""
  if (!token) return { id: "openai", nome: "OpenAI (IA)", descricao: "Agente inteligente e automações", conectado: false, configurado: false, detalhe: "Chave de API não configurada" }
  const t0 = Date.now()
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })
    return {
      id: "openai", nome: "OpenAI (IA)", descricao: "Agente inteligente e automações",
      conectado: res.ok, configurado: true,
      detalhe: res.ok ? "API ativa" : `HTTP ${res.status}`,
      latencia: Date.now() - t0,
    }
  } catch {
    return { id: "openai", nome: "OpenAI (IA)", descricao: "Agente inteligente e automações", conectado: false, configurado: true, detalhe: "Timeout ou erro de rede" }
  }
}

async function checkVercel(): Promise<IntegracaoStatus> {
  const token = process.env.VERCEL_TOKEN ?? process.env.VERCEL_ACCESS_TOKEN ?? ""
  if (!token) return { id: "vercel", nome: "Vercel", descricao: "Deploy e hospedagem do sistema", conectado: true, configurado: true, detalhe: "Aplicação em produção" }
  const t0 = Date.now()
  try {
    const res = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    return {
      id: "vercel", nome: "Vercel", descricao: "Deploy e hospedagem do sistema",
      conectado: res.ok, configurado: true,
      detalhe: res.ok ? "Deploy ativo" : `HTTP ${res.status}`,
      latencia: Date.now() - t0,
    }
  } catch {
    return { id: "vercel", nome: "Vercel", descricao: "Deploy e hospedagem do sistema", conectado: true, configurado: true, detalhe: "Aplicação em produção" }
  }
}

async function checkViaCep(): Promise<IntegracaoStatus> {
  const t0 = Date.now()
  try {
    const res = await fetch("https://viacep.com.br/ws/01001000/json/", { signal: AbortSignal.timeout(6000) })
    return {
      id: "viacep", nome: "ViaCEP", descricao: "Consulta automática de endereços",
      conectado: res.ok, configurado: true,
      detalhe: res.ok ? "API pública disponível" : `HTTP ${res.status}`,
      latencia: Date.now() - t0,
    }
  } catch {
    return { id: "viacep", nome: "ViaCEP", descricao: "Consulta automática de endereços", conectado: false, configurado: true, detalhe: "Serviço indisponível" }
  }
}

export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Você precisa estar logado para realizar esta ação." }, { status: 401 })

  const results = await Promise.allSettled([
    checkSupabase(),
    checkMelhorEnvio(),
    checkZApi(),
    checkAsaas(),
    checkOpenAI(),
    checkVercel(),
    checkViaCep(),
  ])

  const integracoes = results.map(r =>
    r.status === "fulfilled" ? r.value : { id: "unknown", nome: "Erro", descricao: "", conectado: false, configurado: false, detalhe: "Erro interno" }
  )

  return NextResponse.json({ integracoes, verificado_em: new Date().toISOString() })
}
