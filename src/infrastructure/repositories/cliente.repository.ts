// ══════════════════════════════════════════════════════════════════
// ClienteRepositorySupabase — implementação de IClienteRepository.
// Fallbacks graduais para colunas que podem não existir em produção:
//   1º tenta com todas as colunas (entrega + apelido/instagram)
//   2º sem entrega (migration 017 pendente)
//   3º sem apelido/instagram (migration 009 pendente)
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type { IClienteRepository } from "@/application/clientes/ports"
import type { Cliente } from "@/domain/clientes/cliente"

export class ClienteRepositorySupabase implements IClienteRepository {
  constructor(private readonly sb: SupabaseClient) {}

  // Colunas garantidamente existentes desde o setup inicial.
  private toRowBase(c: Cliente) {
    return {
      nome: c.nome,
      cpf_cnpj: c.cpfCnpj,
      email: c.email,
      data_nasc: c.dataNasc,
      celular: c.celular,
      cep: c.cep,
      logradouro: c.logradouro,
      numero: c.numero,
      complemento: c.complemento,
      bairro: c.bairro,
      cidade: c.cidade,
      estado: c.estado,
    }
  }

  // Colunas da migration 009 (apelido/instagram).
  private toApelidoInstagramRow(c: Cliente) {
    return { apelido: c.apelido, instagram: c.instagram }
  }

  // Colunas da migration 017 (endereço de entrega).
  private toEntregaRow(c: Cliente) {
    return {
      entrega_cep: c.entregaCep,
      entrega_logradouro: c.entregaLogradouro,
      entrega_numero: c.entregaNumero,
      entrega_complemento: c.entregaComplemento,
      entrega_bairro: c.entregaBairro,
      entrega_cidade: c.entregaCidade,
      entrega_estado: c.entregaEstado,
    }
  }

  private toRow(c: Cliente) {
    return { ...this.toRowBase(c), ...this.toApelidoInstagramRow(c) }
  }

  /** Postgres 42703 = coluna não existe. */
  private ehColunaNaoExiste(err: { code?: string; message?: string }): boolean {
    return err.code === "42703" || (!!err.message && err.message.includes("column") && err.message.includes("does not exist"))
  }

  async criar(cliente: Cliente): Promise<{ id: number }> {
    const r1 = await this.sb
      .from("clientes")
      .insert({ ...this.toRow(cliente), ...this.toEntregaRow(cliente) })
      .select("id")
      .single()
    if (!r1.error) return { id: r1.data.id as number }

    if (this.ehColunaNaoExiste(r1.error)) {
      // Tenta sem entrega
      const r2 = await this.sb.from("clientes").insert(this.toRow(cliente)).select("id").single()
      if (!r2.error) return { id: r2.data.id as number }

      if (this.ehColunaNaoExiste(r2.error)) {
        // Tenta sem apelido/instagram nem entrega
        const r3 = await this.sb.from("clientes").insert(this.toRowBase(cliente)).select("id").single()
        if (r3.error) throw new Error(r3.error.message)
        return { id: r3.data.id as number }
      }
      throw new Error(r2.error.message)
    }
    throw new Error(r1.error.message)
  }

  async atualizar(id: number, cliente: Cliente): Promise<void> {
    const r1 = await this.sb
      .from("clientes")
      .update({ ...this.toRow(cliente), ...this.toEntregaRow(cliente) })
      .eq("id", id)
    if (!r1.error) return

    if (this.ehColunaNaoExiste(r1.error)) {
      // Tenta sem entrega
      const r2 = await this.sb.from("clientes").update(this.toRow(cliente)).eq("id", id)
      if (!r2.error) return

      if (this.ehColunaNaoExiste(r2.error)) {
        // Tenta sem apelido/instagram nem entrega
        const r3 = await this.sb.from("clientes").update(this.toRowBase(cliente)).eq("id", id)
        if (r3.error) throw new Error(r3.error.message)
        return
      }
      throw new Error(r2.error.message)
    }
    throw new Error(r1.error.message)
  }

  async existePorCelular(celular: string): Promise<boolean> {
    const { count, error } = await this.sb
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("celular", celular)
    if (error) throw new Error(error.message)
    return (count ?? 0) > 0
  }
}
