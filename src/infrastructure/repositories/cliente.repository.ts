// ══════════════════════════════════════════════════════════════════
// ClienteRepositorySupabase — implementação de IClienteRepository.
// Sem fallback de schema: depende da migration 009 (apelido/instagram).
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type { IClienteRepository } from "@/application/clientes/ports"
import type { Cliente } from "@/domain/clientes/cliente"

export class ClienteRepositorySupabase implements IClienteRepository {
  constructor(private readonly sb: SupabaseClient) {}

  private toRow(c: Cliente) {
    return {
      nome: c.nome,
      apelido: c.apelido,
      cpf_cnpj: c.cpfCnpj,
      email: c.email,
      data_nasc: c.dataNasc,
      celular: c.celular,
      instagram: c.instagram,
      cep: c.cep,
      logradouro: c.logradouro,
      numero: c.numero,
      complemento: c.complemento,
      bairro: c.bairro,
      cidade: c.cidade,
      estado: c.estado,
    }
  }

  async criar(cliente: Cliente): Promise<{ id: number }> {
    const { data, error } = await this.sb
      .from("clientes")
      .insert(this.toRow(cliente))
      .select("id")
      .single()
    if (error) throw new Error(error.message)
    return { id: data.id as number }
  }

  async atualizar(id: number, cliente: Cliente): Promise<void> {
    const { error } = await this.sb.from("clientes").update(this.toRow(cliente)).eq("id", id)
    if (error) throw new Error(error.message)
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
