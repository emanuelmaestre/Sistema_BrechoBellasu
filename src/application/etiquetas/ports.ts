export interface IEtiquetaRepository {
  findById(id: number): Promise<import('@/domain/etiquetas/etiqueta').EtiquetaProps | null>
  findByVenda(vendaId: number): Promise<import('@/domain/etiquetas/etiqueta').EtiquetaProps[]>
  save(etiqueta: Omit<import('@/domain/etiquetas/etiqueta').EtiquetaProps, 'id'>): Promise<number>
  updateStatus(id: number, status: import('@/domain/etiquetas/etiqueta').StatusEtiqueta): Promise<void>
  markNotified(id: number): Promise<void>
}
