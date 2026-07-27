import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  createServerClient: () => ({ rpc: mocks.rpc }),
}))

vi.mock("@/lib/with-auth", () => ({
  withAuth: (
    handler: (
      req: NextRequest,
      ctx: unknown,
      auth: { id: number; perfil: string }
    ) => Promise<Response>
  ) => (
    req: NextRequest,
    ctx: unknown
  ) => handler(req, ctx, { id: 7, perfil: "operador" }),
}))

import { POST } from "./route"

function request(body: unknown) {
  return new NextRequest("http://localhost/api/clientes/22/penalidades", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

const context = {
  params: Promise.resolve({ id: "22" }),
}

describe("POST /api/clientes/[id]/penalidades", () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.rpc.mockResolvedValue({ data: 33, error: null })
  })

  it("valida e normaliza os dados antes de chamar a funcao atomica", async () => {
    const response = await POST(request({
      motivo: "nao_pagou_prazo",
      live_id: "10",
      observacao: "  teste  ",
    }), context)

    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith("fn_penalidade_entrada", {
      p_cliente_id: 22,
      p_live_id: 10,
      p_motivo: "nao_pagou_prazo",
      p_obs: "teste",
      p_user_id: 7,
    })
  })

  it("rejeita live malformada sem consultar o banco", async () => {
    const response = await POST(request({
      motivo: "nao_pagou_prazo",
      live_id: "10abc",
    }), context)

    expect(response.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("traduz duplicidade atomica para conflito", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    })

    const response = await POST(request({
      motivo: "desistiu_apos_contemplar",
      live_id: 10,
    }), context)

    expect(response.status).toBe(409)
  })
})
