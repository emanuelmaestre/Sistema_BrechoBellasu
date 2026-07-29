import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { meSaldo, meRecarregar } from "@/lib/melhorenvio"
import { sfSaldo, sfConfigurado } from "@/lib/superfrete"

export const dynamic = "force-dynamic"

interface SaldoProvider {
  configurado: boolean
  ok:          boolean
  saldo:       number
  erro?:       string
}

// GET /api/etiquetas/saldo — saldo das DUAS transportadoras.
// Cada uma é consultada de forma independente: a indisponibilidade de uma
// não impede a exibição do saldo da outra.
export const GET = withAuth(async () => {
  const [resME, resSF] = await Promise.allSettled([
    meSaldo(),
    sfConfigurado() ? sfSaldo() : Promise.reject(new Error("Token não configurado.")),
  ])

  const melhorenvio: SaldoProvider = { configurado: true, ok: false, saldo: 0 }
  let saldoTotal = 0, reservado = 0, dividas = 0

  if (resME.status === "fulfilled") {
    saldoTotal = Number(resME.value.balance ?? 0)
    reservado  = Number(resME.value.reserved ?? 0)
    dividas    = Number(resME.value.debts ?? 0)
    // Saldo realmente utilizável para pagar etiquetas: desconta dívidas.
    melhorenvio.saldo = Math.max(0, saldoTotal - dividas)
    melhorenvio.ok    = true
  } else {
    melhorenvio.erro = resME.reason instanceof Error ? resME.reason.message : "Não foi possível consultar o saldo."
  }

  const superfrete: SaldoProvider = { configurado: sfConfigurado(), ok: false, saldo: 0 }
  if (resSF.status === "fulfilled") {
    superfrete.saldo = Number(resSF.value.balance ?? 0)
    superfrete.ok    = true
  } else {
    superfrete.erro = resSF.reason instanceof Error ? resSF.reason.message : "Não foi possível consultar o saldo."
  }

  return NextResponse.json({
    // Campos de topo mantidos por compatibilidade (referem-se ao Melhor Envio).
    saldo: melhorenvio.saldo,
    saldo_total: saldoTotal,
    saldo_reservado: reservado,
    saldo_dividas: dividas,
    melhorenvio,
    superfrete,
  })
})

// POST /api/etiquetas/saldo — cria recarga PIX
export const POST = withAuth(async (req: NextRequest) => {
  const { valor } = await req.json()
  if (!valor || isNaN(Number(valor)) || Number(valor) < 1) {
    return NextResponse.json({ erro: "Valor inválido. Mínimo R$ 1,00." }, { status: 400 })
  }

  try {
    const data = await meRecarregar(Number(valor))
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível gerar a recarga. Tente pelo Painel Melhor Envio."
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
})
