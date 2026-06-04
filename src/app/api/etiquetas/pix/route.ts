import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import {
  adicionarCarrinho,
  checkoutComPix,
  gerarEtiquetas,
  buscarPedido,
  imprimirEtiqueta,
  cepOrigem,
  defaultVolume,
  type MECartItem,
} from "@/lib/melhorenvio"
import { createServerClient } from "@/lib/supabase"
import { montarRegistroEtiqueta } from "@/lib/etiqueta-snapshot"

export const dynamic = "force-dynamic"

// POST /api/etiquetas/pix
// Fase 1: add ao carrinho + checkout PIX → retorna QR Code
// Fase 2: após pagamento confirmado, gerar etiqueta (order_id já existe)
export const POST = withAuth(async (req: NextRequest, _ctx: unknown, auth: { id: number; perfil: string }) => {
  try {
    const body = await req.json()
    const { service_id, venda_id, cliente_id, tipo_etiqueta, destinatario, order_id } = body

    // ── Fase 2: já tem order_id pago → gerar etiqueta ────────────
    if (order_id) {
      await gerarEtiquetas([order_id]).catch(() => {})
      const result = await buscarPedido(order_id).catch(() => null)
      if (!result) return NextResponse.json({ erro: "Não foi possível gerar a etiqueta. Verifique o pagamento." }, { status: 400 })
      const printed = await imprimirEtiqueta([order_id]).catch(() => null)

      // Persiste registro + snapshot no histórico do cliente (best-effort)
      if (destinatario && service_id) {
        try {
          const sb = createServerClient()
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
            label_url:     printed?.url ?? result.label_url ?? null,
            criado_por:    auth.id,
          }))
        } catch (e) {
          console.error("[POST /api/etiquetas/pix] falha ao salvar histórico:", (e as Error).message)
        }
      }

      return NextResponse.json({ gerado: true, id: result.id, label_url: printed?.url ?? result.label_url ?? null, tracking: result.tracking })
    }

    // ── Fase 1: criar pedido + checkout PIX ───────────────────────
    if (!service_id || !destinatario?.postal_code) {
      return NextResponse.json({ erro: "Selecione um serviço de envio e informe o CEP do destinatário." }, { status: 400 })
    }

    // ME exige CPF/CNPJ do destinatário para emitir a etiqueta
    if (!String(destinatario?.cpf ?? "").replace(/\D/g, "")) {
      return NextResponse.json({ erro: "Informe o CPF/CNPJ do destinatário para gerar a etiqueta." }, { status: 400 })
    }

    const sb = createServerClient()
    const { data: config } = await sb.from("configuracoes").select("valor").eq("chave", "empresa").maybeSingle()
    const empresa = (config?.valor ?? {}) as Record<string, string>

    if (!empresa.logradouro || !empresa.cidade) {
      return NextResponse.json({
        erro: "Endereço da empresa incompleto. Configure em Configurações → Empresa.",
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
        non_commercial: true,
        platform: "Brechó Bellasu",
      },
      // ME sempre exige products (declaração de conteúdo obrigatória)
      products: [{
        name: "Produtos de vestuário usados",
        quantity: 1,
        unitary_value: parseFloat(destinatario.valor_declarado ?? "0") || 1,
      }],
      tag: venda_id ? `Venda #${venda_id}` : undefined,
    }

    const [pedido] = await adicionarCarrinho([cartItem])
    if (!pedido?.id) throw new Error("Não foi possível adicionar ao carrinho. Verifique os dados e tente novamente.")

    // Checkout via PIX
    const checkout = await checkoutComPix([pedido.id])

    const pixData = checkout.payment ?? checkout.pix
    const copyPaste = pixData?.copy_paste
    const qrBase64  = pixData?.qr_code_base64
    const expiresAt = pixData?.expires_at

    return NextResponse.json({
      gerado:     false,
      order_id:   pedido.id,
      copy_paste: copyPaste ?? null,
      qr_code_base64: qrBase64 ?? null,
      expires_at: expiresAt ?? null,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível gerar o PIX. Tente novamente."
    console.error("[POST /api/etiquetas/pix]", msg)
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
