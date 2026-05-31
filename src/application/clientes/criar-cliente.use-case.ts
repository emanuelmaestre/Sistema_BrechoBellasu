// CriarClienteUseCase — valida e persiste um novo cliente.
import { type Result, ok } from "@/domain/shared/result"
import { Cliente, type ClienteInput } from "@/domain/clientes/cliente"
import type { IClienteRepository } from "./ports"

export type CriarClienteInput = ClienteInput

export class CriarClienteUseCase {
  constructor(private readonly clientes: IClienteRepository) {}

  async execute(input: CriarClienteInput): Promise<Result<{ id: number }>> {
    const cliente = Cliente.criar(input)
    if (!cliente.ok) return cliente
    const { id } = await this.clientes.criar(cliente.value)
    return ok({ id })
  }
}
