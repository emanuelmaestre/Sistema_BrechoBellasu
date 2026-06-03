import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import {
  listarEtiquetas,
  adicionarCarrinho,
  checkoutEtiquetas,
  gerarEtiquetas,
  buscarPedido,
  imprimirEtiqueta,
  cepOrigem,
  defaultVolume,
  type MECartItem,
} from "@/lib/melhorenvio"
import { createServerClient } from "@/lib/supabase"
import { enviarTexto } from "@/lib/zapi"

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
    const { service_id, venda_id, destinatario, checkout_auto } = body

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
      try {
        await checkoutEtiquetas([pedido.id])
      } catch (e) {
        const m = (e as Error).message.toLowerCase()
        if (m.includes("saldo") || m.includes("insufficient") || m.includes("balance")) {
          return NextResponse.json({
            erro: "Saldo insuficiente na carteira do Melhor Envio. Recarregue para gerar a etiqueta.",
          }, { status: 402 })
        }
        throw e
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

    // 3. Persiste referência no Supabase (se tabela existir)
    try {
      await sb.from("etiquetas").insert({
        me_order_id:  result.id,
        me_protocol:  result.protocol,
        me_tracking:  result.tracking,
        venda_id:     venda_id ?? null,
        service_id:   parseInt(service_id),
        status:       result.status ?? "pending",
        cep_destino:  String(destinatario.postal_code).replace(/\D/g, ""),
        label_url:    label_url ?? result.label_url ?? null,
        criado_por:   auth.id,
      })
    } catch { /* tabela pode não existir ainda — não é bloqueante */ }

    // 4. Notifica a cliente com o link de rastreio (assíncrono, não bloqueia)
    //    Só quando a etiqueta foi efetivamente gerada (tem tracking) e há telefone.
    if (result.tracking && destinatario.telefone) {
      const nome = (destinatario.nome ?? "Cliente").split(" ")[0]
      const linkRastreio = `https://melhorrastreio.com.br/rastreio/${result.tracking}`
      const mensagem = `Oi ${nome}! 📦\n\nSeu pedido foi enviado! Acompanhe aqui:\n${linkRastreio}\n\nCódigo de rastreio: *${result.tracking}*`
      enviarTexto(destinatario.telefone, mensagem, "rastreio_envio").catch(() => {})
    }

    return NextResponse.json({ ...result, label_url: label_url ?? result.label_url ?? null }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível gerar a etiqueta. Verifique os dados e tente novamente."
    console.error("[POST /api/etiquetas]", msg)
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
