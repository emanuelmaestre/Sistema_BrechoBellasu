// Contrato do repositório de Clientes.
import type { Cliente } from "@/domain/clientes/cliente"

export interface IClienteRepository {
  criar(cliente: Cliente): Promise<{ id: number }>
  atualizar(id: number, cliente: Cliente): Promise<void>
  existePorCelular(celular: string): Promise<boolean>
}
