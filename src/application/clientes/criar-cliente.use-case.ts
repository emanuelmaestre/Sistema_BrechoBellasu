// CriarClienteUseCase — valida e persiste um novo cliente.
import { type Result, ok, err } from "@/domain/shared/result"
import { Cliente, type ClienteInput } from "@/domain/clientes/cliente"
import { ConflitoError } from "@/domain/shared/domain-error"
import type { IClienteRepository } from "./ports"

export type CriarClienteInput = ClienteInput

export class CriarClienteUseCase {
  constructor(private readonly clientes: IClienteRepository) {}

  async execute(input: CriarClienteInput): Promise<Result<{ id: number }>> {
    const cliente = Cliente.criar(input)
    if (!cliente.ok) return cliente

    if (cliente.value.celular) {
      const existe = await this.clientes.existePorCelular(cliente.value.celular)
      if (existe) return err(new ConflitoError("Já existe um cliente com este celular/WhatsApp."))
    }

    const { id } = await this.clientes.criar(cliente.value)
    return ok({ id })
  }
}
