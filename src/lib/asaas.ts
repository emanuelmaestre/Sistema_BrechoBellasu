// ─── Utilitário Asaas ─────────────────────────────────────
// Cria cobrança via Payment Link: PIX e Cartão de Crédito (UNDEFINED)
// Para PROMOCIONAL: cliente paga os juros do cartão (informado na descrição)
// Para NOVIDADES:   sem acréscimo (loja absorve)
// Regras de parcelamento sem juros incluídas na descrição do link.

import { regraParcelamento } from "@/lib/parcelamento"

// O Asaas rejeita emojis e símbolos no campo "description" (parse_error).
// Remove acentos, emojis e qualquer caractere fora do conjunto seguro.
function sanitizarDescricao(texto: string): string {
  return texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // remove acentos
    .replace(/[^a-zA-Z0-9 .,\-/()]/g, "")              // mantém apenas seguros
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500)
}

export async function gerarLinkAsaas(params: {
  nome: string
  cpf?: string | null
  valor: number
  descricao: string
  tipoLive?: "novidades" | "promocional"
  dataLive?: string | null   // YYYY-MM-DD — define vencimento = dataLive + 2 dias
  // Dados extras do cadastro para pré-preencher o link
  email?: string | null
  celular?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
}): Promise<{ url: string; paymentId: string } | null> {
  const token = process.env.ASAAS_TOKEN
  if (!token) return null
  const base = process.env.ASAAS_URL ?? "https://api.asaas.com/v3"

  // Monta objeto com dados do cliente (só campos com valor)
  const dadosCliente = {
    name:         params.nome,
    cpfCnpj:      params.cpf?.replace(/\D/g, "") || undefined,
    email:        params.email || undefined,
    mobilePhone:  params.celular?.replace(/\D/g, "") || undefined,
    address:      params.logradouro || undefined,
    addressNumber: params.numero || undefined,
    complement:   params.complemento || undefined,
    province:     params.bairro || undefined,
    city:         params.cidade || undefined,
    state:        params.estado || undefined,
    postalCode:   params.cep?.replace(/\D/g, "") || undefined,
  }

  try {
    // 1. Busca ou cria/atualiza cliente no Asaas
    let asaasCustomerId: string | null = null

    if (params.cpf) {
      const busca = await fetch(`${base}/customers?cpfCnpj=${params.cpf.replace(/\D/g, "")}`, {
        headers: { access_token: token, "Content-Type": "application/json" },
      })
      if (busca.ok) {
        const bd = await busca.json()
        if (bd.data?.length > 0) {
          asaasCustomerId = bd.data[0].id
          // Atualiza o cadastro com os dados mais recentes
          await fetch(`${base}/customers/${asaasCustomerId}`, {
            method: "PUT",
            headers: { access_token: token, "Content-Type": "application/json" },
            body: JSON.stringify(dadosCliente),
          })
        }
      }
    }

    if (!asaasCustomerId) {
      const criar = await fetch(`${base}/customers`, {
        method: "POST",
        headers: { access_token: token, "Content-Type": "application/json" },
        body: JSON.stringify(dadosCliente),
      })
      const cd = await criar.json()
      if (criar.ok) {
        asaasCustomerId = cd.id
      } else {
        console.error("[Asaas] Erro ao criar cliente:", JSON.stringify(cd))
      }
    }

    if (!asaasCustomerId) return null

    // 2. Vencimento = data_live + 2 dias (ou hoje + 2 se não houver data da live)
    const baseVenc = params.dataLive ? new Date(params.dataLive + "T12:00:00") : new Date()
    baseVenc.setDate(baseVenc.getDate() + 2)
    const dueDate = baseVenc.toISOString().split("T")[0]

    // 3. Regra de parcelamento baseada no valor FINAL (já descontado créditos/descontos)
    const ehPromocional = params.tipoLive === "promocional"
    const regra = regraParcelamento(params.valor)
    const avisoPromocional = ehPromocional ? " - Pgto. cartao: juros por conta da cliente" : ""
    const descricaoFinal = sanitizarDescricao(`${params.descricao} - ${regra.descricaoLink}${avisoPromocional}`)

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

    const pd = await cobranca.json()
    if (!cobranca.ok) {
      console.error("[Asaas] Erro ao criar cobrança:", JSON.stringify(pd))
      return null
    }
    const url = pd.invoiceUrl ?? pd.bankSlipUrl ?? null
    if (!url || !pd.id) {
      console.error("[Asaas] Resposta sem invoiceUrl/id:", JSON.stringify(pd))
      return null
    }
    return { url, paymentId: pd.id }
  } catch (err) {
    console.error("[Asaas] Exceção:", err)
    return null
  }
}

/** Consulta status de um pagamento Asaas pelo ID */
export async function consultarPagamentoAsaas(paymentId: string): Promise<"PAGO" | "EM_ABERTO" | null> {
  const token = process.env.ASAAS_TOKEN
  if (!token || !paymentId) return null
  const base = process.env.ASAAS_URL ?? "https://api.asaas.com/v3"
  try {
    const res = await fetch(`${base}/payments/${paymentId}`, {
      headers: { access_token: token, "Content-Type": "application/json" },
    })
    if (!res.ok) return null
    const pd = await res.json()
    // Status Asaas: CONFIRMED, RECEIVED = pago; PENDING, OVERDUE = em aberto
    if (["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(pd.status)) return "PAGO"
    return "EM_ABERTO"
  } catch {
    return null
  }
}
