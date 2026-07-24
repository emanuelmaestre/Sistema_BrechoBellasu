import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { meUsuario } from "@/lib/melhorenvio"
import { sfBaseUrl, sfConfigurado, sfUsuario } from "@/lib/superfrete"

export const dynamic = "force-dynamic"

interface ProviderStatus {
  configurado: boolean
  conectado: boolean
  env: string
  mensagem?: string
  usuario?: { nome: string; email: string }
  cep_origem?: string
}

async function statusMelhorEnvio(): Promise<ProviderStatus> {
  const token = process.env.MELHOR_ENVIO_TOKEN?.trim()
  const env = process.env.MELHOR_ENVIO_ENV ?? "sandbox"

  if (!token) {
    return { configurado: false, conectado: false, env, mensagem: "Token não configurado." }
  }

  try {
    const usuario = await meUsuario()
    return {
      configurado: true,
      conectado: true,
      env,
      usuario: { nome: `${usuario.firstname} ${usuario.lastname}`.trim(), email: usuario.email },
      cep_origem: process.env.MELHOR_ENVIO_CEP_ORIGEM ?? "não configurado",
    }
  } catch (err) {
    const mensagem = err instanceof Error
      ? err.message
      : "Não foi possível verificar a conexão com o Melhor Envio."
    return { configurado: true, conectado: false, env, mensagem }
  }
}

async function statusSuperFrete(): Promise<ProviderStatus> {
  const env = process.env.SUPERFRETE_ENV ?? "production"

  if (!sfConfigurado()) {
    return {
      configurado: false,
      conectado: false,
      env,
      mensagem: "Token ou remetente não configurado.",
    }
  }

  try {
    const usuario = await sfUsuario()
    return {
      configurado: true,
      conectado: true,
      env,
      usuario: { nome: usuario.name, email: usuario.email },
      cep_origem: process.env.SUPERFRETE_CEP_ORIGEM
        ?? process.env.MELHOR_ENVIO_CEP_ORIGEM
        ?? "não configurado",
    }
  } catch (err) {
    const mensagem = err instanceof Error
      ? err.message
      : `Não foi possível verificar a conexão com ${sfBaseUrl()}.`
    return { configurado: true, conectado: false, env, mensagem }
  }
}

// GET /api/etiquetas/status — verifica os provedores sem expor credenciais
export const GET = withAuth(async () => {
  const [melhorenvio, superfrete] = await Promise.all([
    statusMelhorEnvio(),
    statusSuperFrete(),
  ])

  return NextResponse.json({
    // Campos legados preservados para consumidores existentes.
    configurado: melhorenvio.conectado,
    env: melhorenvio.env,
    mensagem: melhorenvio.mensagem,
    usuario: melhorenvio.usuario,
    cep_origem: melhorenvio.cep_origem,
    algum_configurado: melhorenvio.conectado || superfrete.conectado,
    melhorenvio,
    superfrete,
  })
})
