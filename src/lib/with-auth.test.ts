import { afterEach, describe, expect, it } from "vitest"
import jwt from "jsonwebtoken"
import { NextRequest, NextResponse } from "next/server"
import { AUTH_COOKIE } from "./auth"
import { withAdminAuth } from "./with-auth"

const originalJwtSecret = process.env.JWT_SECRET

afterEach(() => {
  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET
  } else {
    process.env.JWT_SECRET = originalJwtSecret
  }
})

function request(perfil?: string) {
  const headers = new Headers()
  if (perfil) {
    process.env.JWT_SECRET = "teste-secret-comprido"
    const token = jwt.sign({ id: 1, perfil }, process.env.JWT_SECRET)
    headers.set("cookie", `${AUTH_COOKIE}=${token}`)
  }
  return new NextRequest("http://localhost/api/admin/teste", { headers })
}

describe("withAdminAuth", () => {
  const handler = withAdminAuth(async (_req, _ctx, auth) => {
    return NextResponse.json({ id: auth.id })
  })

  it("rejeita requisicao anonima", async () => {
    const response = await handler(request(), undefined)
    expect(response.status).toBe(401)
  })

  it("rejeita perfil nao administrativo com 403", async () => {
    const response = await handler(request("operador"), undefined)
    expect(response.status).toBe(403)
  })

  it("permite perfil administrativo", async () => {
    const response = await handler(request("admin"), undefined)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: 1 })
  })
})
