import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { calcularFrete, cepOrigem, defaultVolume } from "@/lib/melhorenvio"
import { sfCalcularFrete, sfCepOrigem, sfDefaultVolume, sfConfigurado, type SFCotacaoResult } from "@/lib/superfrete"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { cep_destino, altura, largura, comprimento, peso, carrier = "melhorenvio" } = body

    if (!cep_destino) return NextResponse.json({ erro: "CEP de destino obrigatório." }, { status: 400 })

    const volume = {
      height:  parseFloat(altura)      || 0,
      width:   parseFloat(largura)     || 0,
      length:  parseFloat(comprimento) || 0,
      weight:  parseFloat(peso)        || 0,
    }

    if (carrier === "superfrete") {
      if (!sfConfigurado()) {
        return NextResponse.json({
          erro: "Super Frete não configurado. Adicione SUPERFRETE_TOKEN e SUPERFRETE_SENDER_ID nas variáveis de ambiente.",
        }, { status: 503 })
      }

      const vol = sfDefaultVolume()
      const resultados = await sfCalcularFrete({
        cep_origem:  sfCepOrigem().replace(/\D/g, ""),
        cep_destino: String(cep_destino).replace(/\D/g, ""),
        volume: {
          height: volume.height || vol.height,
          width:  volume.width  || vol.width,
          length: volume.length || vol.length,
          weight: volume.weight || vol.weight,
        },
      })

      const validos   = (resultados as SFCotacaoResult[]).filter(r => !r.error && r.price)
      const invalidos = (resultados as SFCotacaoResult[]).filter(r => !!r.error)
      return NextResponse.json({ servicos: validos, erros: invalidos, carrier: "superfrete" })
    }

    // Melhor Envio (padrão)
    const vol = defaultVolume()
    const resultados = await calcularFrete({
      from:    { postal_code: cepOrigem().replace(/\D/g, "") },
      to:      { postal_code: String(cep_destino).replace(/\D/g, "") },
      package: {
        height: volume.height || vol.height,
        width:  volume.width  || vol.width,
        length: volume.length || vol.length,
        weight: volume.weight || vol.weight,
      },
    })

    const validos   = resultados.filter(r => !r.error && r.price)
    const invalidos = resultados.filter(r => !!r.error)
    return NextResponse.json({ servicos: validos, erros: invalidos, carrier: "melhorenvio" })

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível calcular o frete. Verifique o CEP e tente novamente."
    console.error("[POST /api/etiquetas/cotacao]", msg)
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
