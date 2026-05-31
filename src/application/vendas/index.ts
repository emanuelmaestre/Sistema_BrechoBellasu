// Barrel da aplicação de Vendas.
export { CriarVendaUseCase, type CriarVendaInput } from "./criar-venda.use-case"
export { CancelarVendaUseCase } from "./cancelar-venda.use-case"
export type { IVendaRepository, EstoqueReader, VendaPersistida } from "./ports"
