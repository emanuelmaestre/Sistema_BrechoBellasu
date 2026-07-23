import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { withAuth } from "@/lib/with-auth"

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
      signal: AbortSignal.timeout(4000),
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
      signal: AbortSignal.timeout(4000),
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

async function checkOpenAI(): Promise<IntegracaoStatus> {
  const token = process.env.OPENAI_API_KEY ?? ""
  if (!token) return { id: "openai", nome: "OpenAI (IA)", descricao: "Agente inteligente e automações", conectado: false, configurado: false, detalhe: "Chave de API não configurada" }
  const t0 = Date.now()
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
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
      signal: AbortSignal.timeout(4000),
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
    const res = await fetch("https://viacep.com.br/ws/01001000/json/", { signal: AbortSignal.timeout(4000) })
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

async function checkSuperFrete(): Promise<IntegracaoStatus> {
  const token    = process.env.SUPERFRETE_TOKEN ?? ""
  const senderId = process.env.SUPERFRETE_SENDER_ID ?? ""
  if (!token || !senderId) {
    return {
      id: "superfrete", nome: "Super Frete", descricao: "Cálculo de fretes e etiquetas (alternativa)",
      conectado: false, configurado: false,
      detalhe: "SUPERFRETE_TOKEN e SUPERFRETE_SENDER_ID não configurados",
    }
  }
  const t0 = Date.now()
  try {
    const base = process.env.SUPERFRETE_ENV === "sandbox"
      ? "https://sandbox.superfrete.com/api/v0"
      : "https://api.superfrete.com/api/v0"
    const res = await fetch(`${base}/user/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        // Super Frete exige User-Agent — sem ele retorna 401 "Token inválida!"
        "User-Agent": process.env.SUPERFRETE_USER_AGENT ?? "Brecho Bellasu (bellasu.brecho@gmail.com)",
      },
      signal: AbortSignal.timeout(4000),
    })
    return {
      id: "superfrete", nome: "Super Frete", descricao: "Cálculo de fretes e etiquetas (alternativa)",
      conectado: res.ok, configurado: true,
      detalhe: res.ok ? "Conta ativa" : `HTTP ${res.status}`,
      latencia: Date.now() - t0,
    }
  } catch {
    return {
      id: "superfrete", nome: "Super Frete", descricao: "Cálculo de fretes e etiquetas (alternativa)",
      conectado: false, configurado: true, detalhe: "Timeout ou erro de rede",
    }
  }
}

async function checkGoogle(): Promise<IntegracaoStatus> {
  const sb = createServerClient()
  const { data } = await sb
    .from("configuracoes")
    .select("valor")
    .eq("chave", "google_tokens")
    .maybeSingle()
  const tokens = data?.valor as Record<string, string> | null
  if (!tokens?.access_token) {
    return { id: "google", nome: "Google Contatos", descricao: "Sincronização de clientes com Google Contacts", conectado: false, configurado: false, detalhe: "Conta Google não conectada" }
  }
  return {
    id: "google", nome: "Google Contatos", descricao: "Sincronização de clientes com Google Contacts",
    conectado: true, configurado: true,
    detalhe: tokens.email ? `Conectado como ${tokens.email}` : "Conta conectada",
  }
}

export const GET = withAuth(async () => {
  const results = await Promise.allSettled([
    checkSupabase(),
    checkMelhorEnvio(),
    checkSuperFrete(),
    checkZApi(),
    checkOpenAI(),
    checkVercel(),
    checkViaCep(),
    checkGoogle(),
  ])

  const integracoes = results.map(r =>
    r.status === "fulfilled" ? r.value : { id: "unknown", nome: "Erro", descricao: "", conectado: false, configurado: false, detalhe: "Erro interno" }
  )

  return NextResponse.json({ integracoes, verificado_em: new Date().toISOString() })
})
