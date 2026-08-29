import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { meSaldo, meRecarregar, RECARGA_MINIMA } from "@/lib/melhorenvio"
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

// POST /api/etiquetas/saldo — cria recarga PIX na carteira do Melhor Envio.
// O SuperFrete não tem endpoint de carteira na API: recarga só pelo painel deles.
export const POST = withAuth(async (req: NextRequest) => {
  const { valor } = await req.json()
  const valorNum = Number(valor)

  if (!valorNum || isNaN(valorNum)) {
    return NextResponse.json({ erro: "Informe um valor para recarregar." }, { status: 400 })
  }
  if (valorNum < RECARGA_MINIMA) {
    return NextResponse.json({ erro: `Valor mínimo da recarga é R$ ${RECARGA_MINIMA.toFixed(2).replace(".", ",")}.` }, { status: 400 })
  }
  if (valorNum > 5000) {
    return NextResponse.json({ erro: "Valor máximo por recarga é R$ 5.000,00." }, { status: 400 })
  }

  try {
    const recarga = await meRecarregar(valorNum)
    return NextResponse.json(recarga)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível gerar a recarga. Tente pelo painel do Melhor Envio."
    console.error("[POST /api/etiquetas/saldo]", msg)
    return NextResponse.json({ erro: msg }, { status: 502 })
  }
})
