import { afterEach, describe, expect, it, vi } from "vitest"
import { requireCronAuth, requireZapiWebhookAuth } from "./server-guards"

const originalCronSecret = process.env.CRON_SECRET
const originalZapiSecret = process.env.ZAPI_WEBHOOK_SECRET

function request(headers?: HeadersInit) {
  return new Request("http://localhost/api/teste", { headers })
}

afterEach(() => {
  vi.restoreAllMocks()

  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET
  } else {
    process.env.CRON_SECRET = originalCronSecret
  }

  if (originalZapiSecret === undefined) {
    delete process.env.ZAPI_WEBHOOK_SECRET
  } else {
    process.env.ZAPI_WEBHOOK_SECRET = originalZapiSecret
  }
})

describe("requireCronAuth", () => {
  it("falha fechado quando CRON_SECRET nao esta configurado", async () => {
    delete process.env.CRON_SECRET
    vi.spyOn(console, "error").mockImplementation(() => {})

    const response = requireCronAuth(request())

    expect(response?.status).toBe(500)
    await expect(response?.json()).resolves.toEqual({ erro: "Erro de configuracao do servidor." })
  })

  it("rejeita token invalido", async () => {
    process.env.CRON_SECRET = "segredo"

    const response = requireCronAuth(request({ authorization: "Bearer errado" }))

    expect(response?.status).toBe(401)
    await expect(response?.json()).resolves.toEqual({ erro: "Nao autorizado." })
  })

  it("aceita bearer token valido", () => {
    process.env.CRON_SECRET = "segredo"

    expect(requireCronAuth(request({ authorization: "Bearer segredo" }))).toBeNull()
  })

  it("aceita header x-cron-secret valido", () => {
    process.env.CRON_SECRET = "segredo"

    expect(requireCronAuth(request({ "x-cron-secret": "segredo" }))).toBeNull()
  })
})

describe("requireZapiWebhookAuth", () => {
  it("falha fechado quando ZAPI_WEBHOOK_SECRET nao esta configurado", async () => {
    delete process.env.ZAPI_WEBHOOK_SECRET
    vi.spyOn(console, "error").mockImplementation(() => {})

    const response = requireZapiWebhookAuth(request())

    expect(response?.status).toBe(500)
    await expect(response?.json()).resolves.toEqual({ erro: "Erro de configuracao do servidor." })
  })

  it("rejeita token invalido", async () => {
    process.env.ZAPI_WEBHOOK_SECRET = "segredo"

    const response = requireZapiWebhookAuth(request({ authorization: "Bearer errado" }))

    expect(response?.status).toBe(401)
    await expect(response?.json()).resolves.toEqual({ erro: "Nao autorizado." })
  })

  it("aceita bearer token valido", () => {
    process.env.ZAPI_WEBHOOK_SECRET = "segredo"

    expect(requireZapiWebhookAuth(request({ authorization: "Bearer segredo" }))).toBeNull()
  })

  it("aceita header x-zapi-webhook-secret valido", () => {
    process.env.ZAPI_WEBHOOK_SECRET = "segredo"

    expect(requireZapiWebhookAuth(request({ "x-zapi-webhook-secret": "segredo" }))).toBeNull()
  })
})
