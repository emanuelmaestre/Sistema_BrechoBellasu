"use client"

import { useQuery } from "@tanstack/react-query"
import { Globe, ExternalLink, Package, ShoppingBag, Settings2, AlertCircle } from "lucide-react"
import { apiGet } from "@/services/api"
import { fmtBRL, fmtData, cn } from "@/lib/utils"

type Pedido = {
  id: number; status: string; total: number; created_at: string
  cliente_nome?: string; email?: string
}

const STATUS_COLORS: Record<string, string> = {
  pendente:    "bg-amber-600/15 text-amber-400",
  processando: "bg-blue-600/15 text-blue-400",
  enviado:     "bg-purple-600/15 text-purple-400",
  entregue:    "bg-emerald-600/15 text-emerald-400",
  cancelado:   "bg-red-600/15 text-red-400",
}

const SITE_URL = "https://www.brechobellasu.com.br"

export default function SitePage() {
  const { data: pedidos, isLoading } = useQuery<{ data: Pedido[]; total: number }>({
    queryKey: ["site-pedidos"],
    queryFn: () => apiGet("/site/pedidos?limit=20"),
    staleTime: 60_000,
    retry: false,
  })

  const items = [
    { icon: Package,      label: "Catálogo publicado",        url: `${SITE_URL}/catalogo`,  desc: "Endpoint público com todos os produtos ativos" },
    { icon: ShoppingBag,  label: "Receber pedidos",            url: `${SITE_URL}/webhook`,   desc: "Webhook para novos pedidos do e-commerce" },
    { icon: Settings2,    label: "Configuração do site",       url: null,                    desc: "Gerenciado via tabela configuracoes (chave: site)" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Globe size={22} className="text-blue-400"/>
        <div>
          <h2 className="text-white font-bold text-xl">Site & E-commerce</h2>
          <p className="text-slate-400 text-sm">Integração com {SITE_URL}</p>
        </div>
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm transition-colors">
          <ExternalLink size={14}/> Abrir site
        </a>
      </div>

      {/* Status banner */}
      <div className="bg-amber-600/10 border border-amber-600/20 rounded-2xl px-5 py-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5"/>
        <div>
          <p className="text-amber-300 font-medium text-sm">Site em desenvolvimento</p>
          <p className="text-amber-400/70 text-xs mt-0.5">A infraestrutura de integração está pronta. Quando o site estiver ativo, os pedidos aparecerão aqui automaticamente.</p>
        </div>
      </div>

      {/* Endpoints */}
      <div>
        <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold mb-3">Endpoints disponíveis</p>
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.label} className="bg-slate-800/40 border border-white/5 rounded-2xl px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center shrink-0">
                <item.icon size={18} className="text-blue-400"/>
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{item.label}</p>
                <p className="text-slate-400 text-xs mt-0.5">{item.desc}</p>
              </div>
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 transition-colors">
                  <ExternalLink size={15}/>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pedidos */}
      <div>
        <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold mb-3">
          Pedidos recentes {pedidos ? `(${pedidos.total ?? 0})` : ""}
        </p>
        <div className="bg-slate-800/40 border border-white/5 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-white/5">
                {["#","Cliente","Total","Status","Data"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Carregando...</td></tr>
              ) : !pedidos?.data?.length ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Nenhum pedido ainda. Quando o site receber pedidos, eles aparecerão aqui.
                </td></tr>
              ) : pedidos.data.map(p => (
                <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">#{p.id}</td>
                  <td className="px-4 py-3 text-white text-sm">{p.cliente_nome ?? p.email ?? "—"}</td>
                  <td className="px-4 py-3 text-white text-sm font-semibold">{fmtBRL(p.total)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[p.status] ?? "bg-slate-600/30 text-slate-400")}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{fmtData(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
