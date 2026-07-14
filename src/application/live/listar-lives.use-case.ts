import { type Result, ok, err } from "@/domain/shared/result"
import { ValidacaoError } from "@/domain/shared/domain-error"
import type { ILiveRepository, ListarLivesInput, ListarLivesOutput, LiveStatus } from "./ports"

const STATUS_VALIDOS: LiveStatus[] = ["aberta", "encerrada", "disparada"]

export class ListarLivesUseCase {
  constructor(private readonly lives: ILiveRepository) {}

  async execute(input: ListarLivesInput = {}): Promise<Result<ListarLivesOutput>> {
    const page = Math.max(1, Number(input.page) || 1)
    const limit = Math.min(Math.max(1, Number(input.limit) || 50), 200)
    const status = input.status?.trim() || null

    if (status && !STATUS_VALIDOS.includes(status as LiveStatus)) {
      return err(new ValidacaoError("Status da live invalido."))
    }

    const output = await this.lives.listar({
      status: status as LiveStatus | null,
      page,
      limit,
    })

    return ok(output)
  }
}
