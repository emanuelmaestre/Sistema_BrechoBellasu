// ══════════════════════════════════════════════════════════════════
// AsaasGateway — implementação de IPagamentoGateway sobre o Asaas.
// Reaproveita a integração HTTP já existente em lib/asaas (não reescreve
// a lógica de cobrança); apenas a expõe atrás da porta do domínio.
// ══════════════════════════════════════════════════════════════════
import { gerarLinkAsaas, consultarPagamentoAsaas } from "@/lib/asaas"
import type { IPagamentoGateway, CobrancaParams } from "@/application/live/ports"

export class AsaasGateway implements IPagamentoGateway {
  gerarCobranca(params: CobrancaParams) {
    return gerarLinkAsaas({
      nome: params.nome,
      cpf: params.cpf,
      valor: params.valor,
      descricao: params.descricao,
      tipoLive: params.tipoLive,
    })
  }

  consultarStatus(paymentId: string) {
    return consultarPagamentoAsaas(paymentId)
  }
}
