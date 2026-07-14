import { describe, expect, test } from "vitest"
import { ListarLivesUseCase } from "./listar-lives.use-case"
import type { ILiveRepository, LiveListItem } from "./ports"

const live: LiveListItem = {
  id: 1,
  titulo: "Live teste",
  data_live: "2026-07-10",
  status: "aberta",
}

function repoFake(): ILiveRepository & { lastListInput?: unknown } {
  return {
    async listar(input) {
      this.lastListInput = input
      return { data: [live], total: 1 }
    },
    async criar() {
      return live
    },
  }
}

describe("ListarLivesUseCase", () => {
  test("normaliza paginacao e delega ao repositorio", async () => {
    const repo = repoFake()
    const result = await new ListarLivesUseCase(repo).execute({ page: -1, limit: 999 })

    expect(result.ok).toBe(true)
    expect(repo.lastListInput).toEqual({ page: 1, limit: 200, status: null })
  })

  test("rejeita status invalido", async () => {
    const result = await new ListarLivesUseCase(repoFake()).execute({ status: "rascunho" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("validacao")
  })
})
