import { describe, it, expect, afterEach } from "vitest"
import type { NextRequest } from "next/server"
import { googleRedirectUri } from "./google-oauth-redirect"

const req = (origin: string) => ({ nextUrl: { origin } }) as NextRequest

const VARS = ["APP_URL", "VERCEL_PROJECT_PRODUCTION_URL", "NEXT_PUBLIC_APP_URL", "NODE_ENV"] as const

// process.env.NODE_ENV é tipada como somente-leitura; o acesso indexado
// contorna isso sem recorrer a `any`.
const env = process.env as Record<string, string | undefined>
const original = Object.fromEntries(VARS.map(v => [v, env[v]]))

afterEach(() => {
  for (const v of VARS) {
    if (original[v] === undefined) delete env[v]
    else env[v] = original[v]
  }
})

function cenario(vars: Partial<Record<(typeof VARS)[number], string>>) {
  for (const v of VARS) delete env[v]
  for (const [k, val] of Object.entries(vars)) if (val !== undefined) env[k] = val
}

describe("googleRedirectUri", () => {
  it("em produção ignora o localhost herdado do .env.local e usa o domínio da Vercel", () => {
    cenario({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      VERCEL_PROJECT_PRODUCTION_URL: "brecho-bellasu.vercel.app",
    })
    expect(googleRedirectUri(req("https://brecho-bellasu-abc123.vercel.app")))
      .toBe("https://brecho-bellasu.vercel.app/api/google/callback")
  })

  it("nunca usa a URL única do deploy quando há domínio estável", () => {
    cenario({ NODE_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "brecho-bellasu.vercel.app" })
    expect(googleRedirectUri(req("https://brecho-bellasu-aqu8mgyxa-emanuel-maestre.vercel.app")))
      .toBe("https://brecho-bellasu.vercel.app/api/google/callback")
  })

  it("APP_URL tem precedência sobre tudo", () => {
    cenario({
      NODE_ENV: "production",
      APP_URL: "https://sistema.bellasu.com.br",
      VERCEL_PROJECT_PRODUCTION_URL: "brecho-bellasu.vercel.app",
    })
    expect(googleRedirectUri(req("https://x.vercel.app")))
      .toBe("https://sistema.bellasu.com.br/api/google/callback")
  })

  it("em desenvolvimento o localhost continua valendo", () => {
    cenario({ NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "http://localhost:3000" })
    expect(googleRedirectUri(req("http://localhost:3000")))
      .toBe("http://localhost:3000/api/google/callback")
  })

  it("aceita domínio sem esquema e remove a barra final", () => {
    cenario({ NODE_ENV: "production", APP_URL: "brecho-bellasu.vercel.app/" })
    expect(googleRedirectUri(req("https://x.vercel.app")))
      .toBe("https://brecho-bellasu.vercel.app/api/google/callback")
  })

  it("sem nenhuma variável cai na origin da requisição", () => {
    cenario({ NODE_ENV: "production" })
    expect(googleRedirectUri(req("https://brecho-bellasu.vercel.app")))
      .toBe("https://brecho-bellasu.vercel.app/api/google/callback")
  })
})
