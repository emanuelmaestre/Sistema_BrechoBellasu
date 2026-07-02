// ══════════════════════════════════════════════════════════════════
// ProdutoRepositorySupabase — implementação concreta de IProdutoRepository.
// Única camada que conhece o Supabase para produtos.
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js"
import type { IProdutoRepository } from "@/application/produtos/ports"
import type { Produto } from "@/domain/produtos/produto"
import { CodigoDuplicadoError } from "@/domain/produtos/errors"

/** Próximo código sequencial (maior código numérico existente + 1, com 4 dígitos). */
export async function calcularProximoCodigo(sb: SupabaseClient): Promise<string> {
  const { data: existing } = await sb
    .from("produtos")
    .select("codigo")
    .not("codigo", "is", null)
    .limit(10000)
  const maxNum = (existing ?? [])
    .map((p: { codigo: string | null }) => parseInt(p.codigo ?? "0", 10))
    .filter((n: number) => !isNaN(n) && n > 0)
    .reduce((max: number, n: number) => Math.max(max, n), 0)
  return String(maxNum + 1).padStart(4, "0")
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
