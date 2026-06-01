// ══════════════════════════════════════════════════════════════════
// ProdutoRepositorySupabase — implementação concreta de IProdutoRepository.
// Única camada que conhece o Supabase para produtos.
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type { IProdutoRepository } from "@/application/produtos/ports"
import type { Produto } from "@/domain/produtos/produto"
import { CodigoDuplicadoError } from "@/domain/produtos/errors"

export class ProdutoRepositorySupabase implements IProdutoRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async criar(produto: Produto): Promise<{ id: number }> {
    let codigo = produto.codigo
    if (!codigo) {
      const { data } = await this.sb.rpc("fn_next_produto_codigo")
      codigo = String(data ?? "00001")
    }

    const { data, error } = await this.sb
      .from("produtos")
      .insert({
        nome: produto.nome,
        codigo,
        categoria_id: produto.categoriaId,
        marca: produto.marca,
        preco_venda: produto.precoVenda.reais,
        preco_custo: produto.precoCusto.reais,
        estoque_atual: produto.estoqueAtual,
        controlar_estoque: produto.controlarEstoque,
        unidade_medida: produto.unidadeMedida,
        cor: produto.cor,
      })
      .select("id")
      .single()

    if (error) {
      if (error.code === "23505") throw new CodigoDuplicadoError()
      throw new Error(error.message)
    }
    return { id: data.id as number }
  }

  async buscarEstoque(id: number): Promise<number | null> {
    const { data, error } = await this.sb
      .from("produtos")
      .select("estoque_atual")
      .eq("id", id)
      .single()
    if (error || !data) return null
    return Number(data.estoque_atual)
  }

  async definirEstoque(id: number, novo: number): Promise<number> {
    const { data, error } = await this.sb
      .from("produtos")
      .update({ estoque_atual: novo })
      .eq("id", id)
      .select("estoque_atual")
      .single()
    if (error) throw new Error(error.message)
    return Number(data.estoque_atual)
  }
}
