// SincronizarPagamentosLiveUseCase — consulta o gateway e marca como
// pagas as compras pendentes da live que já foram quitadas.
import { type Result, ok, err } from "@/domain/shared/result"
import { ValidacaoError } from "@/domain/shared/domain-error"
import type { ILiveCompraRepository, IPagamentoGateway } from "./ports"

export class SincronizarPagamentosLiveUseCase {
  constructor(
    private readonly compras: ILiveCompraRepository,
    private readonly pagamento: IPagamentoGateway,
  ) {}

  async execute(liveId: number): Promise<Result<{ atualizadas: number }>> {
    if (!Number.isInteger(liveId) || liveId <= 0) {
      return err(new ValidacaoError("Live inválida."))
    }

    const pendentes = await this.compras.listarPendentes(liveId)
    let atualizadas = 0

    for (const p of pendentes) {
      if (!p.asaasPaymentId) continue
      const status = await this.pagamento.consultarStatus(p.asaasPaymentId)
      if (status === "PAGO") {
        await this.compras.marcarPago(p.id)
        atualizadas++
      }
    }

    return ok({ atualizadas })
  }
}
