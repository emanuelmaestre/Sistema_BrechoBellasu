// AtualizarClienteUseCase — valida e persiste alterações de um cliente.
import { type Result, ok, err } from "@/domain/shared/result"
import { ValidacaoError } from "@/domain/shared/domain-error"
import { Cliente, type ClienteInput } from "@/domain/clientes/cliente"
import type { IClienteRepository } from "./ports"

export class AtualizarClienteUseCase {
  constructor(private readonly clientes: IClienteRepository) {}

  async execute(id: number, input: ClienteInput): Promise<Result<void>> {
    if (!Number.isInteger(id) || id <= 0) {
      return err(new ValidacaoError("ID de cliente inválido."))
    }
    const cliente = Cliente.criar(input)
    if (!cliente.ok) return cliente
    await this.clientes.atualizar(id, cliente.value)
    return ok(undefined)
  }
}
