// ══════════════════════════════════════════════════════════════════
// Última chave PIX e prazo usados no disparo das compras da live.
// Fica em configuracoes (chave "live_disparo") para valer em qualquer
// aparelho: o modal já abre preenchido e o reenvio da cobrança usa o
// prazo ORIGINAL daquela live.
// ══════════════════════════════════════════════════════════════════
import { createServerClient } from "./supabase"

const CHAVE = "live_disparo"

export interface ConfigDisparoLive {
  chave_pix: string
  dias_prazo: number
  /** prazo usado no disparo de cada live, por id — base do reenvio */
  prazo_por_live: Record<string, number>
}

export async function lerConfigDisparo(): Promise<ConfigDisparoLive> {
  const sb = createServerClient()
  const { data } = await sb.from("configuracoes").select("valor").eq("chave", CHAVE).maybeSingle()
  const v = (data?.valor ?? {}) as Partial<ConfigDisparoLive>
  return {
    chave_pix: typeof v.chave_pix === "string" ? v.chave_pix : "",
    dias_prazo: typeof v.dias_prazo === "number" && v.dias_prazo >= 1 ? v.dias_prazo : 2,
    prazo_por_live: v.prazo_por_live && typeof v.prazo_por_live === "object" ? v.prazo_por_live : {},
  }
}

export async function salvarConfigDisparo(p: { chave_pix?: string; dias_prazo?: number; live_id?: number }): Promise<boolean> {
  const cfg = await lerConfigDisparo()
  const dias = typeof p.dias_prazo === "number" && p.dias_prazo >= 1 ? Math.floor(p.dias_prazo) : cfg.dias_prazo
  const novo: ConfigDisparoLive = {
    chave_pix: (p.chave_pix ?? "").trim() || cfg.chave_pix,
    dias_prazo: dias,
    prazo_por_live: p.live_id ? { ...cfg.prazo_por_live, [String(p.live_id)]: dias } : cfg.prazo_por_live,
  }
  const sb = createServerClient()
  const { error } = await sb.from("configuracoes").upsert({ chave: CHAVE, valor: novo }, { onConflict: "chave" })
  return !error
}
