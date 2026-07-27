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

import { PATCH } from "./route"

function request(body: unknown) {
  return new NextRequest(
    "http://localhost/api/clientes/22/penalidades/33",
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }
  )
}

describe("PATCH /api/clientes/[id]/penalidades/[penalidade_id]", () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.rpc.mockResolvedValue({ data: 33, error: null })
  })

  it("vincula atomicamente a remocao ao cliente da URL", async () => {
    const response = await PATCH(request({
      motivo_remocao: "  corrigida  ",
    }), {
      params: Promise.resolve({ id: "22", penalidade_id: "33" }),
    })

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("fn_penalidade_remover", {
      p_penalidade_id: 33,
      p_cliente_id: 22,
      p_motivo_remocao: "corrigida",
      p_user_id: 7,
    })
  })

  it("rejeita ids parciais sem consultar o banco", async () => {
    const response = await PATCH(request({}), {
      params: Promise.resolve({ id: "22abc", penalidade_id: "33" }),
    })

    expect(response.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("nao revela detalhes internos quando a penalidade nao pertence ao cliente", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "internal detail" },
    })

    const response = await PATCH(request({}), {
      params: Promise.resolve({ id: "22", penalidade_id: "99" }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      erro: "Penalidade ativa nao encontrada para esta cliente.",
    })
  })
})
