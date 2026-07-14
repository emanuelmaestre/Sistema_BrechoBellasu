import { type Result, ok, err } from "@/domain/shared/result"
import { ValidacaoError } from "@/domain/shared/domain-error"
import type { CriarLiveInput, ILiveRepository, LiveListItem, LiveTipo } from "./ports"

const TIPOS_VALIDOS: LiveTipo[] = ["novidades", "promocional"]

function normalizarTexto(value?: string | null): string | null {
  const text = value?.trim() ?? ""
  return text ? text : null
}

function tituloPadrao(dataLive: string): string {
  const data = new Date(`${dataLive}T12:00:00`)
  return `Live ${data.toLocaleDateString("pt-BR")}`
}

export class CriarLiveUseCase {
  constructor(private readonly lives: ILiveRepository) {}

  async execute(input: CriarLiveInput): Promise<Result<LiveListItem>> {
    const dataLive = normalizarTexto(input.dataLive)
    if (!dataLive) return err(new ValidacaoError("Data da live e obrigatoria."))

    const tipo = input.tipo ?? "novidades"
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return err(new ValidacaoError("Tipo da live invalido."))
    }

    const live = await this.lives.criar({
      dataLive,
      titulo: normalizarTexto(input.titulo) ?? tituloPadrao(dataLive),
      plataforma: normalizarTexto(input.plataforma),
      tipo,
      observacoes: normalizarTexto(input.observacoes),
      linkLive: normalizarTexto(input.linkLive),
    })

    return ok(live)
  }
}
