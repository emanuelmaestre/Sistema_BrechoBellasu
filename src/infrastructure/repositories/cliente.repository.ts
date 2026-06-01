// ══════════════════════════════════════════════════════════════════
// ClienteRepositorySupabase — implementação de IClienteRepository.
// Sem fallback de schema: depende da migration 009 (apelido/instagram).
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type { IClienteRepository } from "@/application/clientes/ports"
import type { Cliente } from "@/domain/clientes/cliente"

export class ClienteRepositorySupabase implements IClienteRepository {
  constructor(private readonly sb: SupabaseClient) {}

  // Campos base (sempre existem). Endereço de entrega vai à parte
  // porque a coluna pode não existir ainda (migration 017 pendente).
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

  /** True se o erro do Postgres é "coluna inexistente" de endereço de entrega. */
  private ehColunaEntregaAusente(msg?: string): boolean {
    return !!msg && msg.includes("entrega_")
  }

  async criar(cliente: Cliente): Promise<{ id: number }> {
    // Tenta com endereço de entrega; se a coluna não existir, insere sem.
    const completo = await this.sb
      .from("clientes")
      .insert({ ...this.toRow(cliente), ...this.toEntregaRow(cliente) })
      .select("id")
      .single()

    if (completo.error && this.ehColunaEntregaAusente(completo.error.message)) {
      const base = await this.sb.from("clientes").insert(this.toRow(cliente)).select("id").single()
      if (base.error) throw new Error(base.error.message)
      return { id: base.data.id as number }
    }
    if (completo.error) throw new Error(completo.error.message)
    return { id: completo.data.id as number }
  }

  async atualizar(id: number, cliente: Cliente): Promise<void> {
    const completo = await this.sb
      .from("clientes")
      .update({ ...this.toRow(cliente), ...this.toEntregaRow(cliente) })
      .eq("id", id)

    if (completo.error && this.ehColunaEntregaAusente(completo.error.message)) {
      const base = await this.sb.from("clientes").update(this.toRow(cliente)).eq("id", id)
      if (base.error) throw new Error(base.error.message)
      return
    }
    if (completo.error) throw new Error(completo.error.message)
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
