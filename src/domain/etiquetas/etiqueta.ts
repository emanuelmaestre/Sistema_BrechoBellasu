export type StatusEtiqueta = "pending" | "released" | "generated" | "posted" | "delivered" | "canceled" | "in transit"

export interface EtiquetaProps {
  id?: number
  meOrderId: string
  meProtocol?: string | null
  meTracking?: string | null
  vendaId?: number | null
  serviceId?: number
  status: StatusEtiqueta
  cepDestino?: string | null
  labelUrl?: string | null
  notificadoEnvio?: boolean
  criadoPor?: number
}

export class Etiqueta {
  constructor(readonly props: EtiquetaProps) {}

  get id() { return this.props.id }
  get status() { return this.props.status }
  get tracking() { return this.props.meTracking }
  get labelUrl() { return this.props.labelUrl }

  isDelivered() { return this.props.status === "delivered" }
  isPosted() { return this.props.status === "posted" || this.props.status === "in transit" }
  isCanceled() { return this.props.status === "canceled" }
  isGenerated() { return this.props.status === "generated" }
}
