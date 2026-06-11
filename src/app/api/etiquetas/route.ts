import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import {
  listarEtiquetas,
  adicionarCarrinho,
  checkoutEtiquetas,
  gerarEtiquetas,
  buscarPedido,
  imprimirEtiqueta,
  cancelarEtiqueta,
  meSaldo,
  cepOrigem,
  defaultVolume,
  type MECartItem,
} from "@/lib/melhorenvio"
import { createServerClient } from "@/lib/supabase"
import { enviarTexto } from "@/lib/zapi"
import { montarRegistroEtiqueta } from "@/lib/etiqueta-snapshot"

export const dynamic = "force-dynamic"

// GET /api/etiquetas — lista etiquetas do Melhor Envio
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = req.nextUrl
    const page     = parseInt(searchParams.get("page") ?? "1")
    const per_page = parseInt(searchParams.get("per_page") ?? "20")
    const filter   = searchParams.get("filter") ?? undefined

    const data = await listarEtiquetas({ page, per_page, filter })
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível carregar as etiquetas. Tente novamente."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})

// POST /api/etiquetas — cria etiqueta (carrinho → checkout → gerar)
export const POST = withAuth(async (req: NextRequest, _ctx: unknown, auth: { id: number; perfil: string }) => {
  try {
    const body = await req.json()
    const { service_id, venda_id, cliente_id, tipo_etiqueta, destinatario, checkout_auto } = body

    if (!service_id || !destinatario?.postal_code) {
      return NextResponse.json({ erro: "Selecione um serviço de envio e informe o CEP do destinatário." }, { status: 400 })
    }

    // ME exige CPF/CNPJ do destinatário para emitir a etiqueta
    if (!String(destinatario?.cpf ?? "").replace(/\D/g, "")) {
      return NextResponse.json({ erro: "Informe o CPF/CNPJ do destinatário para gerar a etiqueta." }, { status: 400 })
    }

    // Busca config empresa para remetente
    const sb = createServerClient()
    const { data: config } = await sb.from("configuracoes").select("valor").eq("chave", "empresa").maybeSingle()
    const empresa = (config?.valor ?? {}) as Record<string, string>

    // Valida campos obrigatórios da empresa antes de chamar ME
    if (!empresa.logradouro || !empresa.cidade) {
      return NextResponse.json({
        erro: "Endereço da empresa incompleto. Configure o logradouro e cidade em Configurações → Empresa.",
      }, { status: 422 })
    }

    const vol = defaultVolume()

    const cartItem: MECartItem = {
      service: Number(service_id),
      from: {
        name:        empresa.nome           ?? "Brechó Bellasu",
        phone:       empresa.telefone       ?? "",
        email:       empresa.email          ?? "",
        address:     empresa.logradouro     ?? "",
        number:      empresa.numero         ?? "S/N",
        district:    empresa.bairro         ?? "",
        city:        empresa.cidade         ?? "",
        state_abbr:  empresa.estado         ?? "SP",
        country_id:  "BR",
        postal_code: cepOrigem().replace(/\D/g, ""),
      },
      to: {
        name:       destinatario.nome       ?? "Cliente",
        phone:      destinatario.telefone   ?? "",
        email:      destinatario.email      ?? "",
        document:   String(destinatario.cpf ?? "").replace(/\D/g, ""), // ME exige CPF/CNPJ do destinatário
        address:    destinatario.logradouro ?? "",
        number:     destinatario.numero     ?? "S/N",
        district:   destinatario.bairro     ?? "",
        city:       destinatario.cidade     ?? "",
        state_abbr: destinatario.estado     ?? "SP",
        country_id: "BR",
        postal_code: String(destinatario.postal_code).replace(/\D/g, ""),
        complement: destinatario.complemento ?? "",
      },
      volumes: [{
        height:  parseFloat(destinatario.altura      ?? String(vol.height)),
        width:   parseFloat(destinatario.largura     ?? String(vol.width)),
        length:  parseFloat(destinatario.comprimento ?? String(vol.length)),
        weight:  parseFloat(destinatario.peso        ?? String(vol.weight)),
      }],
      options: {
        insurance_value: parseFloat(destinatario.valor_declarado ?? "0") || undefined,
        non_commercial:  true,
        platform:        "Brechó Bellasu",
      },
      // ME sempre exige products (declaração de conteúdo obrigatória)
      products: [{
        name: "Produtos de vestuário usados",
        quantity: 1,
        unitary_value: parseFloat(destinatario.valor_declarado ?? "0") || 1,
      }],
      tag: venda_id ? `Venda #${venda_id}` : undefined,
    }

    // 1. Adiciona ao carrinho
    const [pedido] = await adicionarCarrinho([cartItem])
    if (!pedido?.id) throw new Error("Falha ao adicionar ao carrinho.")

    let result = pedido
    let label_url: string | undefined

    // 2. Checkout (opcional via flag checkout_auto=true) — paga com saldo da carteira
    if (checkout_auto) {
      const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`

      // ── Checagem proativa: o preço real do pedido (já no carrinho) pode ser
      //    maior que a cotação exibida (seguro, taxas). Comparamos com o saldo
      //    real e, se faltar, informamos o déficit EXATO e desfazemos o carrinho.
      const precoPedido = parseFloat(String(pedido.price ?? "0"))
      if (precoPedido > 0) {
        try {
          const bal = await meSaldo()
          const disponivel = Math.max(0, Number(bal.balance ?? 0) - Number(bal.debts ?? 0))
          if (disponivel < precoPedido) {
            await cancelarEtiqueta(pedido.id).catch(() => {})
            const falta = precoPedido - disponivel
            return NextResponse.json({
              erro: `Saldo insuficiente. O frete custa ${fmt(precoPedido)} e seu saldo disponível é ${fmt(disponivel)} — faltam ${fmt(falta)}. Recarregue a carteira do Melhor Envio ou escolha um frete mais barato.`,
            }, { status: 402 })
          }
        } catch { /* se a consulta de saldo falhar, deixa o checkout decidir */ }
      }

      try {
        const checkout = await checkoutEtiquetas([pedido.id])
        // ME às vezes retorna HTTP 200 mas com errors no corpo
        const erros = checkout?.errors
        if (Array.isArray(erros) && erros.length > 0) {
          await cancelarEtiqueta(pedido.id).catch(() => {})
          const errStr = typeof erros[0] === "string" ? erros[0] : JSON.stringify(erros[0])
          const errMsg = errStr.toLowerCase()
          if (errMsg.includes("saldo") || errMsg.includes("insufficient") || errMsg.includes("funds")) {
            return NextResponse.json({
              erro: "Saldo insuficiente na carteira do Melhor Envio. Recarregue para gerar a etiqueta.",
            }, { status: 402 })
          }
          return NextResponse.json({ erro: `Erro no checkout: ${errStr}` }, { status: 422 })
        }
      } catch (e) {
        // Rollback: remove o pedido órfão do carrinho para não acumular lixo.
        await cancelarEtiqueta(pedido.id).catch(() => {})
        const m  = (e as Error).message
        const ml = m.toLowerCase()
        if (ml.includes("saldo") || ml.includes("insufficient") || ml.includes("funds")) {
          return NextResponse.json({
            erro: "Saldo insuficiente na carteira do Melhor Envio. Recarregue para gerar a etiqueta.",
          }, { status: 402 })
        }
        // Mostra o erro REAL do Melhor Envio em vez de mascarar como saldo.
        return NextResponse.json({
          erro: `Não foi possível finalizar a compra da etiqueta: ${m.slice(0, 200)}`,
        }, { status: 422 })
      }

      // Gera a etiqueta (dispara a geração; não dependemos do formato de retorno)
      await gerarEtiquetas([pedido.id]).catch(() => {})

      // Fonte de verdade: busca o pedido atualizado (status/tracking corretos)
      const atualizado = await buscarPedido(pedido.id).catch(() => null)
      if (atualizado) result = atualizado

      // URL do PDF da etiqueta (não gera cobrança — pedido já está pago)
      const printed = await imprimirEtiqueta([pedido.id]).catch(() => null)
      if (printed?.url) label_url = printed.url
    }

    // 3. Persiste referência + snapshot no Supabase (histórico do cliente)
    try {
      await sb.from("etiquetas").insert(montarRegistroEtiqueta({
        me_order_id:   result.id,
        me_protocol:   result.protocol,
        me_tracking:   result.tracking,
        cliente_id:    cliente_id ? Number(cliente_id) : null,
        venda_id:      venda_id ?? null,
        service_id:    parseInt(service_id),
        status:        result.status ?? "pending",
        destinatario,
        tipo_etiqueta: tipo_etiqueta ?? null,
        label_url:     label_url ?? result.label_url ?? null,
        criado_por:    auth.id,
      }))
    } catch (e) {
      // Não bloqueia a emissão da etiqueta; apenas registra a falha.
      console.error("[POST /api/etiquetas] falha ao salvar histórico:", (e as Error).message)
    }

    // 4. Notifica a cliente com o link de rastreio (assíncrono, não bloqueia).
    //    Usa o código de rastreio dos Correios quando já existe; senão usa o
    //    self_tracking do Melhor Envio (disponível assim que a etiqueta é gerada).
    const codigoRastreio = result.tracking ?? result.self_tracking ?? null
    const telefoneCliente = destinatario.telefone || result.to?.phone
    if (codigoRastreio && telefoneCliente) {
      const nome = (destinatario.nome ?? result.to?.name ?? "Cliente").split(" ")[0]
      const linkRastreio = `https://melhorrastreio.com.br/rastreio/${codigoRastreio}`
      const mensagem = `Oi ${nome}! 📦\n\nSeu pedido foi enviado! Acompanhe aqui:\n${linkRastreio}\n\nCódigo de rastreio: *${codigoRastreio}*`
      enviarTexto(telefoneCliente, mensagem, "rastreio_envio").catch(() => {})
    }

    return NextResponse.json({ ...result, label_url: label_url ?? result.label_url ?? null }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível gerar a etiqueta. Verifique os dados e tente novamente."
    console.error("[POST /api/etiquetas]", msg)
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
