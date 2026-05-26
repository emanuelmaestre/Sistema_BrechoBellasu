// ─── Utilitário Asaas ─────────────────────────────────────
// Cria cobrança via Payment Link: apenas PIX e Cartão de Crédito
// Para PROMOCIONAL: cliente paga os juros do cartão (informado na descrição)
// Para NOVIDADES:   sem acréscimo (loja absorve)

export async function gerarLinkAsaas(params: {
  nome: string
  cpf?: string | null
  valor: number
  descricao: string
  tipoLive?: "novidades" | "promocional"
}): Promise<string | null> {
  const token = process.env.ASAAS_TOKEN
  if (!token) return null
  const base = process.env.ASAAS_URL ?? "https://api.asaas.com/v3"

  try {
    // 1. Busca ou cria cliente no Asaas
    let asaasCustomerId: string | null = null

    if (params.cpf) {
      const busca = await fetch(`${base}/customers?cpfCnpj=${params.cpf.replace(/\D/g, "")}`, {
        headers: { access_token: token, "Content-Type": "application/json" },
      })
      if (busca.ok) {
        const bd = await busca.json()
        if (bd.data?.length > 0) asaasCustomerId = bd.data[0].id
      }
    }

    if (!asaasCustomerId) {
      const criar = await fetch(`${base}/customers`, {
        method: "POST",
        headers: { access_token: token, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: params.nome,
          cpfCnpj: params.cpf?.replace(/\D/g, "") || undefined,
        }),
      })
      if (criar.ok) {
        const cd = await criar.json()
        asaasCustomerId = cd.id
      }
    }

    if (!asaasCustomerId) return null

    // 2. Vencimento em 48h
    const vencimento = new Date()
    vencimento.setDate(vencimento.getDate() + 2)
    const dueDate = vencimento.toISOString().split("T")[0]

    // 3. Para PROMOCIONAL: avisa sobre juros do cartão na descrição
    const ehPromocional = params.tipoLive === "promocional"
    const descricaoFinal = ehPromocional
      ? `${params.descricao} | ⚠️ Pagamento via cartão sujeito a juros por conta do cliente`
      : params.descricao

    // 4. Cria cobrança com PIX ou Cartão de Crédito (billingType UNDEFINED = cliente escolhe entre os habilitados)
    //    Para restringir: criamos com CREDIT_CARD e um segundo para PIX — mas o Asaas invoiceUrl
    //    já exibe apenas as formas habilitadas na conta.
    //    Usamos UNDEFINED para o cliente escolher entre PIX e Cartão no link.
    const cobranca = await fetch(`${base}/payments`, {
      method: "POST",
      headers: { access_token: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: "UNDEFINED",
        value: params.valor,
        dueDate,
        description: descricaoFinal,
      }),
    })

    if (!cobranca.ok) return null
    const pd = await cobranca.json()
    return pd.invoiceUrl ?? pd.bankSlipUrl ?? null
  } catch {
    return null
  }
}
