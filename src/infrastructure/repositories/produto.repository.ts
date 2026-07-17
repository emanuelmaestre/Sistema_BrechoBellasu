// ══════════════════════════════════════════════════════════════════
// ProdutoRepositorySupabase — implementação concreta de IProdutoRepository.
// Única camada que conhece o Supabase para produtos.
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type { IProdutoRepository } from "@/application/produtos/ports"
import type { Produto } from "@/domain/produtos/produto"
import { CodigoDuplicadoError } from "@/domain/produtos/errors"

/** Próximo código sequencial (maior código numérico existente + 1, sem zeros à esquerda). */
export async function calcularProximoCodigo(sb: SupabaseClient): Promise<string> {
  const { data } = await sb
    .from("produtos")
    .select("codigo_num")
    .not("codigo_num", "is", null)
    .order("codigo_num", { ascending: false })
    .limit(1)
  const maxNum = (data?.[0] as { codigo_num: number } | undefined)?.codigo_num ?? 0
  return String(maxNum + 1)
}

export class ProdutoRepositorySupabase implements IProdutoRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async criar(produto: Produto): Promise<{ id: number }> {
    const codigo = produto.codigo || await calcularProximoCodigo(this.sb)

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
        tamanho: produto.tamanho,
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
