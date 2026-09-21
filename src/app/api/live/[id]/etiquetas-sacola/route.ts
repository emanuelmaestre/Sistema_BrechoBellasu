// ══════════════════════════════════════════════════════════════════
// Etiquetas das sacolas de uma live.
//
// GET  — devolve tudo que a etiqueta precisa: sacolas com produtos,
//        endereço da cliente e o remetente da loja. O emparelhamento
//        acontece no cliente, sobre estes dados, para que reabrir a
//        tela amanhã produza exatamente o mesmo lote de hoje.
// POST — confirma quais sacolas saíram no papel.
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase"
import {
  formatarInstagram, totalDaSacola, totalDivergente, capitalizarNome,
  type ProdutoEtiqueta,
} from "@/lib/etiqueta-sacola"

export const dynamic = "force-dynamic"

function parseLiveId(value: string): number | null {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** Endereço de entrega tem prioridade sobre o do cadastro, quando existe. */
function enderecoDoCliente(c: Record<string, unknown> | null) {
  if (!c) return { logradouro: null, numero: null, bairro: null, complemento: null }
  const temEntrega = Boolean((c.entrega_logradouro as string | null)?.trim())
  return temEntrega
    ? {
        logradouro: (c.entrega_logradouro ?? null) as string | null,
        numero: (c.entrega_numero ?? null) as string | null,
        bairro: (c.entrega_bairro ?? null) as string | null,
        complemento: (c.entrega_complemento ?? null) as string | null,
      }
    : {
        logradouro: (c.logradouro ?? null) as string | null,
        numero: (c.numero ?? null) as string | null,
        bairro: (c.bairro ?? null) as string | null,
        complemento: (c.complemento ?? null) as string | null,
      }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id: idParam } = await params
  const liveId = parseLiveId(idParam)
  if (!liveId) return NextResponse.json({ erro: "Live inválida." }, { status: 400 })

  const sb = createServerClient()

  const { data: live } = await sb
    .from("lives").select("id, data_live, status").eq("id", liveId).single()
  if (!live) return NextResponse.json({ erro: "Live não encontrada." }, { status: 404 })

  const { data: compras, error: erroCompras } = await sb
    .from("live_compras")
    .select("id, cliente_id, nome_cliente, numero_sacola, valor_total, desconto, credito_aplicado, etiqueta_impressa_em")
    .eq("live_id", liveId)
  if (erroCompras) {
    console.error("[etiquetas-sacola] Falha ao carregar compras:", erroCompras.message)
    return NextResponse.json({ erro: "Falha ao carregar as compras da live." }, { status: 500 })
  }

  const lista = compras ?? []
  if (lista.length === 0) {
    return NextResponse.json({ ok: true, live, loja: await lerLoja(sb), sacolas: [] })
  }

  // ── Produtos de todas as compras, numa consulta só ──
  // A cor da LINHA é um override do catálogo: peças vendidas sob o
  // produto genérico compartilham o registro, então linha.cor vem antes.
  const compraIds = lista.map((c) => c.id as number)
  const { data: produtosRaw } = await sb
    .from("live_compra_produtos")
    .select("compra_id, nome_produto, quantidade, preco_live, preco_original, cor, produtos(cor, tamanho)")
    .in("compra_id", compraIds)
    .order("id")

  const produtosPorCompra = new Map<number, ProdutoEtiqueta[]>()
  for (const p of produtosRaw ?? []) {
    const chave = p.compra_id as number
    const prod = p.produtos as { cor?: string | null; tamanho?: string | null } | null
    const linha: ProdutoEtiqueta = {
      nome: String(p.nome_produto ?? ""),
      cor: (p.cor ?? prod?.cor ?? null) as string | null,
      tamanho: (prod?.tamanho ?? null) as string | null,
      quantidade: Number(p.quantidade ?? 1),
      preco: parseFloat(String(p.preco_live ?? p.preco_original ?? 0)),
    }
    const atual = produtosPorCompra.get(chave)
    if (atual) atual.push(linha)
    else produtosPorCompra.set(chave, [linha])
  }

  // ── Endereços, numa consulta só ──
  const clienteIds = [...new Set(
    lista.map((c) => c.cliente_id).filter((v): v is number => typeof v === "number"),
  )]
  const clientesPorId = new Map<number, Record<string, unknown>>()
  if (clienteIds.length > 0) {
    const { data: clientes } = await sb
      .from("clientes")
      .select("id, nome, instagram, logradouro, numero, bairro, complemento, entrega_logradouro, entrega_numero, entrega_bairro, entrega_complemento")
      .in("id", clienteIds)
    for (const c of clientes ?? []) clientesPorId.set(c.id as number, c)
  }

  const sacolas = lista.map((c) => {
    const cliente = typeof c.cliente_id === "number" ? clientesPorId.get(c.cliente_id) ?? null : null
    const produtos = produtosPorCompra.get(c.id as number) ?? []
    const valorTotal = parseFloat(String(c.valor_total ?? 0))
    const desconto = parseFloat(String(c.desconto ?? 0))
    const credito = parseFloat(String(c.credito_aplicado ?? 0))
    return {
      compraId: c.id as number,
      numeroSacola: (c.numero_sacola ?? null) as string | null,
      nomeCliente: ((cliente?.nome as string | null) ?? c.nome_cliente ?? "") as string,
      instagram: formatarInstagram(cliente?.instagram as string | null),
      dataLive: (live.data_live ?? null) as string | null,
      produtos,
      total: totalDaSacola(Math.max(0, valorTotal - desconto - credito), produtos),
      totalDivergente: totalDivergente(Math.max(0, valorTotal - desconto - credito), produtos),
      endereco: enderecoDoCliente(cliente),
      impressaEm: (c.etiqueta_impressa_em ?? null) as string | null,
    }
  })

  return NextResponse.json({ ok: true, live, loja: await lerLoja(sb), sacolas })
}

/** Remetente impresso no rodapé de cada bloco. */
async function lerLoja(sb: ReturnType<typeof createServerClient>) {
  const { data } = await sb
    .from("configuracoes").select("valor").eq("chave", "empresa").maybeSingle()
  const v = (data?.valor ?? {}) as Record<string, string | undefined>
  // A configuração guarda o nome em `nome_fantasia`, e o endereço todo
  // em caixa alta ("R. BARÃO DO AMAZONAS"). Na etiqueta isso vira grito
  // e come largura — normaliza igual ao endereço da cliente.
  return {
    nome: capitalizarNome(v.nome_fantasia ?? v.nome ?? v.razao_social ?? "Brechó Bellasu"),
    logradouro: capitalizarNome(v.logradouro ?? ""),
    numero: (v.numero ?? "").trim(),
    bairro: capitalizarNome(v.bairro ?? ""),
    cidade: capitalizarNome(v.cidade ?? ""),
    estado: (v.estado ?? "").trim().toUpperCase(),
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id: idParam } = await params
  const liveId = parseLiveId(idParam)
  if (!liveId) return NextResponse.json({ erro: "Live inválida." }, { status: 400 })

  const body = await req.json().catch(() => ({})) as { compra_ids?: unknown; desmarcar?: boolean }
  const ids = Array.isArray(body.compra_ids)
    ? body.compra_ids.filter((v): v is number => Number.isSafeInteger(v) && (v as number) > 0)
    : []
  if (ids.length === 0) {
    return NextResponse.json({ erro: "Informe as compras a marcar." }, { status: 400 })
  }

  const sb = createServerClient()
  // O filtro por live_id impede marcar compra de outra live por id solto.
  const { data, error } = await sb
    .from("live_compras")
    .update({ etiqueta_impressa_em: body.desmarcar === true ? null : new Date().toISOString() })
    .eq("live_id", liveId)
    .in("id", ids)
    .select("id")
  if (error) {
    console.error("[etiquetas-sacola] Falha ao marcar impressão:", error.message)
    return NextResponse.json({ erro: "Falha ao registrar a impressão." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, atualizadas: (data ?? []).length })
}
