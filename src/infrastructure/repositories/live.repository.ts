import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  CriarLivePersistida,
  ILiveRepository,
  ListarLivesInput,
  ListarLivesOutput,
  LiveListItem,
} from "@/application/live/ports"

export class LiveRepositorySupabase implements ILiveRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async listar(input: Required<Pick<ListarLivesInput, "page" | "limit">> & { status?: string | null }): Promise<ListarLivesOutput> {
    const from = (input.page - 1) * input.limit
    const to = from + input.limit - 1

    let query = this.sb.from("lives").select("*", { count: "exact" })
    if (input.status) query = query.eq("status", input.status)

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to)

    if (error) throw new Error(error.message)
    return { data: (data ?? []) as LiveListItem[], total: count }
  }

  async criar(input: CriarLivePersistida): Promise<LiveListItem> {
    const row = {
      titulo: input.titulo,
      data_live: input.dataLive,
      plataforma: input.plataforma,
      tipo: input.tipo,
      status: "aberta",
      observacoes: input.observacoes,
      link_live: input.linkLive,
    }

    const withCurrentSchema = await this.sb
      .from("lives")
      .insert(row)
      .select()
      .single()

    if (withCurrentSchema.error?.message?.includes("tipo") || withCurrentSchema.error?.message?.includes("link_live")) {
      const { data, error } = await this.sb
        .from("lives")
        .insert({
          titulo: row.titulo,
          data_live: row.data_live,
          plataforma: row.plataforma,
          status: row.status,
          observacoes: row.observacoes,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data as LiveListItem
    }

    if (withCurrentSchema.error) throw new Error(withCurrentSchema.error.message)
    return withCurrentSchema.data as LiveListItem
  }
}
