import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { calcularFrete, cepOrigem, defaultVolume } from "@/lib/melhorenvio"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { cep_destino, altura, largura, comprimento, peso } = body

    if (!cep_destino) return NextResponse.json({ erro: "CEP de destino obrigatório." }, { status: 400 })

    const vol = defaultVolume()

    const resultados = await calcularFrete({
      from:    { postal_code: cepOrigem().replace(/\D/g, "") },
      to:      { postal_code: String(cep_destino).replace(/\D/g, "") },
      package: {
        height:  parseFloat(altura)     || vol.height,
        width:   parseFloat(largura)    || vol.width,
        length:  parseFloat(comprimento)|| vol.length,
        weight:  parseFloat(peso)       || vol.weight,
      },
    })

    // Filtra resultados com erro
    const validos   = resultados.filter(r => !r.error && r.price)
    const invalidos = resultados.filter(r => !!r.error)

    return NextResponse.json({ servicos: validos, erros: invalidos })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível calcular o frete. Verifique o CEP e tente novamente."
    console.error("[POST /api/etiquetas/cotacao]", msg)
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
