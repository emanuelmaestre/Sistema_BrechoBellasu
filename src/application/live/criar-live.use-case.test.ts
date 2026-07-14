import { describe, expect, test } from "vitest"
import { CriarLiveUseCase } from "./criar-live.use-case"
import type { CriarLivePersistida, ILiveRepository, LiveListItem } from "./ports"

const live: LiveListItem = {
  id: 1,
  titulo: "Live teste",
  data_live: "2026-07-10",
  status: "aberta",
  tipo: "novidades",
}

function repoFake(): ILiveRepository & { lastCreateInput?: CriarLivePersistida } {
  return {
    async listar() {
      return { data: [live], total: 1 }
    },
    async criar(input) {
      this.lastCreateInput = input
      return { ...live, titulo: input.titulo, data_live: input.dataLive, tipo: input.tipo }
    },
  }
}

describe("CriarLiveUseCase", () => {
  test("cria live com titulo padrao e tipo default", async () => {
    const repo = repoFake()
    const result = await new CriarLiveUseCase(repo).execute({ dataLive: "2026-07-10" })

    expect(result.ok).toBe(true)
    expect(repo.lastCreateInput).toMatchObject({
      titulo: "Live 10/07/2026",
      dataLive: "2026-07-10",
      tipo: "novidades",
    })
  })

  test("rejeita data ausente", async () => {
    const result = await new CriarLiveUseCase(repoFake()).execute({})

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("validacao")
  })
})
