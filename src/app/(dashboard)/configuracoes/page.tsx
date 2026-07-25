"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { AnimatePresence, motion } from "motion/react"
import {
  Loader2, Save, Building2, Users, X, Eye, EyeOff,
  Check, ShieldCheck, UserPlus, Pencil, Power,
  Plug, RefreshCw, Wifi, WifiOff, Database, Truck,
  MessageCircle, Globe, MapPin, AlertCircle, Bot,
  Play, CheckCircle2, XCircle, Clock, Send,
  Zap, ChevronDown, Cake, Bell, Package, Tag,
  Megaphone, ImageIcon, Video, Smile, Trash2, History,
  PenLine, Users2, Timer, Sparkles, Undo2,
} from "lucide-react"
import { apiGet, apiPost, apiPatch, apiDelete } from "@/services/api"
import { cn } from "@/lib/utils"
import { useDisparoStore } from "@/stores/disparo.store"
import businessData from "@/data/config/business.json"
import integrationData from "@/data/ui/integrations.json"

const DEFAULTS: EmpresaConfig = businessData.defaults
const PERFIS = businessData.profiles
const REGIME_OPTIONS = businessData.taxRegimes
const COR_INTEGRACAO: Record<string, string> = integrationData.serviceColors
const ACAO_COR: Record<string, string> = integrationData.syncActionColors


// ── Tipos ────────────────────────────────────────────────────
interface EmpresaConfig {
  nome?: string; razao_social?: string; nome_fantasia?: string
  cnpj?: string; ie?: string; telefone?: string; email?: string
  cep?: string; logradouro?: string; numero?: string; complemento?: string
  bairro?: string; cidade?: string; estado?: string
  regime_tributario?: string
  pix_chave?: string; pix_tipo?: string; pix_titular?: string
}

interface Usuario {
  id: number; nome: string; email: string; perfil: string; ativo: boolean
}

type Tab = "empresa" | "usuarios" | "integracoes" | "alertas" | "contatos" | "automacoes" | "campanhas"

interface IntegracaoStatus {
  id: string; nome: string; descricao: string
  conectado: boolean; configurado: boolean
  detalhe?: string; latencia?: number
}

// ── Estilos base ─────────────────────────────────────────────
const iBase = "w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all border focus:border-[color:var(--accent)]"
const iSt: React.CSSProperties = {
  background: "var(--bg-surface)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
}
const labelClass = "block text-[10px] font-semibold uppercase tracking-wider mb-1.5"

// ── Modal Novo / Editar Usuário ──────────────────────────────
function ModalUsuario({
  onClose, onSalvo, inicial,
}: { onClose: () => void; onSalvo: () => void; inicial?: Usuario }) {
  const [nome,   setNome]   = useState(inicial?.nome   ?? "")
  const [email,  setEmail]  = useState(inicial?.email  ?? "")
  const [perfil, setPerfil] = useState(inicial?.perfil ?? "operador")
  const [senha,  setSenha]  = useState("")
  const [ver,    setVer]    = useState(false)
  const [erro,   setErro]   = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  async function salvar() {
    if (!nome.trim() || !email.trim()) { setErro("Nome e e-mail obrigatórios"); return }
    if (!inicial && !senha.trim())     { setErro("Senha obrigatória para novo usuário"); return }
    setSaving(true); setErro("")
    try {
      const body: Record<string, string> = { nome, email, perfil }
      if (senha) body.senha = senha
      if (inicial) {
        await apiPatch(`/usuarios/${inicial.id}`, body)
      } else {
        await apiPost("/usuarios", body)
      }
      onSalvo(); onClose()
    } catch (e: unknown) {
      setErro((e as Error).message || "Erro ao salvar")
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 backdrop-blur-md" style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <UserPlus size={16} style={{ color: "var(--accent)" }} />
            {inicial ? "Editar Usuário" : "Novo Usuário"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={labelClass} style={{ color: "var(--text-muted)" }}>Nome completo *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do usuário"
              className={iBase} style={iSt} />
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--text-muted)" }}>E-mail *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@exemplo.com" className={iBase} style={iSt} />
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--text-muted)" }}>Perfil / Permissão</label>
            <select value={perfil} onChange={e => setPerfil(e.target.value)}
              className={iBase} style={iSt}>
              {PERFIS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--text-muted)" }}>
              {inicial ? "Nova senha (deixe em branco para manter)" : "Senha *"}
            </label>
            <div className="relative">
              <input type={ver ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)}
                placeholder="••••••••" className={cn(iBase, "pr-10")} style={iSt} />
              <button type="button" onClick={() => setVer(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                {ver ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Permissões por perfil */}
          <div className="rounded-xl px-4 py-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <ShieldCheck size={11} /> Permissões do perfil
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "Vendas",      ok: ["admin","operador","caixa"] },
                { label: "Clientes",    ok: ["admin","operador","caixa"] },
                { label: "Produtos",    ok: ["admin","operador","estoque"] },
                { label: "Financeiro",  ok: ["admin"] },
                { label: "Relatórios",  ok: ["admin"] },
                { label: "Etiquetas",   ok: ["admin","operador"] },
                { label: "Configurações",ok:["admin"] },
                { label: "Usuários",    ok: ["admin"] },
              ].map(({ label, ok }) => {
                const tem = ok.includes(perfil)
                return (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0",
                      tem ? "bg-emerald-600/20" : "bg-red-600/15")}>
                      {tem
                        ? <Check size={8} style={{ color: "#4ade80" }} strokeWidth={3} />
                        : <X    size={8} style={{ color: "#f87171" }} strokeWidth={3} />}
                    </span>
                    <span className="text-[11px]" style={{ color: tem ? "var(--text-secondary)" : "var(--text-muted)" }}>
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {erro && <p className="text-sm" style={{ color: "#f87171" }}>{erro}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: "var(--accent)" }}>
              {saving ? <><Loader2 size={13} className="animate-spin inline mr-1.5" />Salvando...</> : "Salvar"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Aba Usuários ─────────────────────────────────────────────
function AbaUsuarios() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<"novo" | Usuario | null>(null)

  const { data, isLoading } = useQuery<{ data: Usuario[] }>({
    queryKey: ["usuarios"],
    queryFn: () => apiGet("/usuarios"),
    staleTime: 60_000,
  })

  const toggleAtivo = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) => apiPatch(`/usuarios/${id}`, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  })

  const usuarios = data?.data ?? []

  const perfilBg: Record<string, { bg: string; text: string }> = {
    admin:    { bg: "rgba(99,102,241,0.15)", text: "#a5b4fc" },
    operador: { bg: "rgba(16,185,129,0.12)", text: "#6ee7b7" },
    caixa:    { bg: "rgba(251,191,36,0.12)", text: "#fcd34d" },
    estoque:  { bg: "rgba(14,165,233,0.12)", text: "#7dd3fc" },
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>Usuários do Sistema</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Gerencie acessos e permissões</p>
        </div>
        <button onClick={() => setModal("novo")}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white"
          style={{ background: "var(--accent)" }}>
          <UserPlus size={15} /> Novo Usuário
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
        {/* Cabeçalho */}
        <div className="grid grid-cols-12 gap-3 px-5 py-3 min-w-[560px]"
          style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          {[["col-span-4","NOME"], ["col-span-4","E-MAIL"], ["col-span-2","PERFIL"], ["col-span-1","STATUS"], ["col-span-1",""]].map(([cls, lbl]) => (
            <div key={lbl} className={cls}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{lbl}</p>
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        )}

        {!isLoading && usuarios.length === 0 && (
          <div className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum usuário encontrado
          </div>
        )}

        {usuarios.map((u, i) => {
          const pc = perfilBg[u.perfil] ?? { bg: "rgba(148,163,184,0.12)", text: "#94a3b8" }
          return (
            <motion.div key={u.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="grid grid-cols-12 gap-3 items-center px-5 py-3.5 transition-colors min-w-[560px]"
              style={{ borderBottom: i < usuarios.length - 1 ? "1px solid var(--border)" : "none" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent" }}>
              <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                  {u.nome[0].toUpperCase()}
                </div>
                <p className="text-sm font-medium truncate uppercase" style={{ color: "var(--text-primary)" }}>{u.nome}</p>
              </div>
              <div className="col-span-4 min-w-0">
                <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{u.email}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize"
                  style={{ background: pc.bg, color: pc.text }}>
                  {u.perfil}
                </span>
              </div>
              <div className="col-span-1">
                <span className={cn("text-[11px] font-semibold px-2 py-1 rounded-full",
                  u.ativo ? "bg-emerald-600/12 text-emerald-400" : "bg-red-600/12 text-red-400")}>
                  {u.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="col-span-1 flex items-center gap-1 justify-end">
                <button onClick={() => setModal(u)} title="Editar"
                  className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => toggleAtivo.mutate({ id: u.id, ativo: !u.ativo })}
                  title={u.ativo ? "Desativar" : "Ativar"}
                  className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = u.ativo ? "#f87171" : "#4ade80" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                  <Power size={13} />
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>

      <AnimatePresence>
        {modal && (
          <ModalUsuario
            onClose={() => setModal(null)}
            onSalvo={() => qc.invalidateQueries({ queryKey: ["usuarios"] })}
            inicial={modal === "novo" ? undefined : modal}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Aba Integrações ───────────────────────────────────────────
const ICONE_INTEGRACAO: Record<string, React.ReactNode> = {
  supabase:    <Database size={20} />,
  melhorenvio: <Truck size={20} />,
  zapi:        <MessageCircle size={20} />,
  openai:      <Bot size={20} />,
  vercel:      <Globe size={20} />,
  viacep:      <MapPin size={20} />,
  google:      <GoogleLogo size={20} />,
  superfrete:  <Package size={20} />,
}

function AbaIntegracoes() {
  const [spinning, setSpinning] = useState(false)
  const [clicked, setClicked]   = useState(false)
  const qc = useQueryClient()

  const { data, isLoading, dataUpdatedAt } = useQuery<{ integracoes: IntegracaoStatus[]; verificado_em: string }>({
    queryKey: ["config-integracoes"],
    queryFn: () => apiGet("/configuracoes/integracoes"),
    staleTime: 5 * 60 * 60 * 1000,   // 5 horas
    refetchInterval: 5 * 60 * 60 * 1000,
  })

  async function handleRefresh() {
    setSpinning(true)
    setClicked(true)
    await qc.invalidateQueries({ queryKey: ["config-integracoes"] })
    setTimeout(() => { setSpinning(false); setClicked(false) }, 1200)
  }

  const integracoes = data?.integracoes ?? []
  const totalOk  = integracoes.filter(i => i.conectado).length
  const totalAll = integracoes.length

  const verificadoEm = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>Integrações & Serviços</h3>
          <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            {isLoading ? "Verificando conexões..." : (
              <>
                <span>{totalOk}/{totalAll} serviços conectados</span>
                {verificadoEm && <span>· Atualizado às {verificadoEm}</span>}
              </>
            )}
          </p>
        </div>

        <motion.button
          onClick={handleRefresh}
          disabled={isLoading}
          whileTap={{ scale: 0.94 }}
          animate={clicked ? {
            boxShadow: ["0 0 0px rgba(99,102,241,0)", "0 0 18px rgba(99,102,241,0.55)", "0 0 6px rgba(99,102,241,0.2)", "0 0 0px rgba(99,102,241,0)"],
            borderColor: ["var(--border)", "var(--accent)", "var(--accent)", "var(--border)"],
          } : {}}
          transition={{ duration: 1.1, ease: "easeInOut" }}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 relative overflow-hidden"
          style={{
            border: "1px solid var(--border)",
            background: clicked ? "var(--accent-bg)" : "var(--bg-surface)",
            color: clicked ? "var(--accent)" : "var(--text-secondary)",
          }}>
          {/* Shimmer ao clicar */}
          {clicked && (
            <motion.span
              className="absolute inset-0 pointer-events-none"
              initial={{ x: "-100%", opacity: 0.4 }}
              animate={{ x: "150%", opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.25), transparent)" }}
            />
          )}
          <motion.div animate={{ rotate: spinning ? 360 : 0 }} transition={{ duration: 0.7, ease: "easeInOut" }}>
            <RefreshCw size={14} />
          </motion.div>
          {clicked ? "Atualizando…" : "Atualizar"}
        </motion.button>
      </div>

      {/* Barra de saúde geral */}
      {!isLoading && totalAll > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl px-5 py-4 mb-5 flex items-center gap-4"
          style={{ background: totalOk === totalAll ? "rgba(16,185,129,0.08)" : "rgba(251,191,36,0.08)", border: `1px solid ${totalOk === totalAll ? "rgba(16,185,129,0.25)" : "rgba(251,191,36,0.25)"}` }}>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: totalOk === totalAll ? "rgba(16,185,129,0.15)" : "rgba(251,191,36,0.15)" }}>
            {totalOk === totalAll
              ? <Wifi size={18} style={{ color: "#4ade80" }} />
              : <AlertCircle size={18} style={{ color: "#fbbf24" }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {totalOk === totalAll ? "Todos os serviços operacionais" : `${totalAll - totalOk} serviço(s) com atenção`}
            </p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(totalOk / totalAll) * 100}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                className="h-full rounded-full"
                style={{ background: totalOk === totalAll ? "#4ade80" : "#fbbf24" }}
              />
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums shrink-0" style={{ color: totalOk === totalAll ? "#4ade80" : "#fbbf24" }}>
            {Math.round((totalOk / totalAll) * 100)}%
          </p>
        </motion.div>
      )}

      {/* Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
              className="rounded-2xl h-28" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} />
          ))}
        </div>
      )}

      {/* Grid de cards */}
      {!isLoading && (
        <div className="grid grid-cols-2 gap-3">
          {integracoes.map((integ, i) => {
            const icone = ICONE_INTEGRACAO[integ.id]
            const cor   = COR_INTEGRACAO[integ.id] ?? "var(--accent)"
            return (
              <motion.div key={integ.id}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 24 }}
                className="rounded-2xl p-5 relative overflow-hidden"
                style={{ background: "var(--bg-card)", border: `1px solid ${integ.conectado ? "rgba(74,222,128,0.15)" : "var(--border)"}` }}>

                {/* Glow de fundo quando conectado */}
                {integ.conectado && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: "radial-gradient(ellipse at top left, rgba(74,222,128,0.04) 0%, transparent 60%)" }} />
                )}

                <div className="flex items-start gap-3.5">
                  {/* Ícone */}
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: `${cor}18`, color: cor }}>
                    {icone ?? <Plug size={20} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{integ.nome}</p>
                      {/* Badge status */}
                      <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: integ.conectado ? "rgba(74,222,128,0.15)" : integ.configurado ? "rgba(248,113,113,0.12)" : "rgba(148,163,184,0.12)",
                          color: integ.conectado ? "#4ade80" : integ.configurado ? "#f87171" : "#94a3b8",
                        }}>
                        {integ.conectado
                          ? <><Check size={8} strokeWidth={3} />Conectado</>
                          : integ.configurado
                            ? <><WifiOff size={8} />Erro</>
                            : <><AlertCircle size={8} />Não config.</>}
                      </span>
                    </div>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{integ.descricao}</p>

                    {/* Detalhe */}
                    {integ.detalhe && (
                      <p className="text-[11px] mt-1.5 truncate" style={{ color: integ.conectado ? "var(--text-secondary)" : "#f87171" }}>
                        {integ.detalhe}
                      </p>
                    )}

                    {/* Latência */}
                    {integ.latencia !== undefined && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{
                          background: integ.latencia < 300 ? "#4ade80" : integ.latencia < 800 ? "#fbbf24" : "#f87171"
                        }} />
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{integ.latencia}ms</span>
                      </div>
                    )}

                    {/* Botão reconectar Google */}
                    {integ.id === "google" && !integ.conectado && (
                      <a href="/api/google/auth" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold"
                        style={{ background: "rgba(234,67,53,0.12)", color: "#ea4335", border: "1px solid rgba(234,67,53,0.25)" }}>
                        <RefreshCw size={10} /> Reconectar Google
                      </a>
                    )}
                  </div>
                </div>

                {/* Indicador lateral */}
                <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full"
                  style={{ background: integ.conectado ? "#4ade80" : integ.configurado ? "#f87171" : "#475569" }} />
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Nota de rodapé */}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        className="text-[11px] text-center mt-5" style={{ color: "var(--text-muted)" }}>
        Verificação automática a cada 5 horas · Clique em Atualizar para verificar agora
      </motion.p>

      {/* Teste Z-API — conexão WhatsApp */}
      <ZApiTestCard />
    </div>
  )
}

function ZApiTestCard() {
  const [zapiStatus, setZapiStatus] = useState<{ conectado: boolean; detalhe: string } | null>(null)
  const [testando, setTestando] = useState(false)

  async function testarZapi() {
    setTestando(true); setZapiStatus(null)
    try {
      const res = await apiPost("/configuracoes/zapi", {}) as { conectado: boolean; detalhe: string }
      setZapiStatus(res)
    } catch { setZapiStatus({ conectado: false, detalhe: "Erro de conexão" }) }
    finally { setTestando(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(37,211,102,0.12)" }}>
          <MessageCircle size={16} style={{ color: "#25d366" }} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>WhatsApp (Z-API)</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Teste a conexão do canal de envio de mensagens</p>
        </div>
      </div>
      <button onClick={testarZapi} disabled={testando}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        style={{ background: "rgba(37,211,102,0.1)", color: "#25d366", border: "1px solid rgba(37,211,102,0.25)" }}>
        {testando ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
        Testar conexão Z-API
      </button>
      {zapiStatus && (
        <p className={cn("text-xs mt-3 px-3 py-2 rounded-lg",
          zapiStatus.conectado ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
          {zapiStatus.conectado ? "✅" : "❌"} {zapiStatus.detalhe}
        </p>
      )}
    </motion.div>
  )
}

function GoogleLogo({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// ── Tipos para sync Google ────────────────────────────────────
type PreviewCliente = {
  id: number; nome: string; nomeMontado: string
  telefone: string | null; telValido: boolean; telErro?: string | null
  temId: boolean; status: string | null; acao: "criar" | "atualizar" | "ignorar"
}

const SYNC_STATUS_ICON: Record<string, React.ReactNode> = {
  pendente:      <Clock         size={13} className="text-slate-400" />,
  sincronizando: <Loader2       size={13} className="animate-spin text-blue-400" />,
  sincronizado:  <CheckCircle2  size={13} className="text-emerald-400" />,
  erro:          <XCircle       size={13} className="text-red-400" />,
}

function AbaGoogle() {
  const { iniciarGoogleSync, job: disparoJob } = useDisparoStore()
  const syncRodando = disparoJob?.tipo === "google-sync" && disparoJob?.status === "running"
  const [filtro, setFiltro] = useState<"todos" | "criar" | "atualizar" | "ignorar">("todos")

  const { data, isLoading, refetch } = useQuery<{ totais: { total: number; criarNovos: number; atualizar: number; semTelefone: number; telInvalido: number; ignorados: number }; clientes: PreviewCliente[]; googleDesconectado?: boolean }>({
    queryKey: ["google-sync-preview"],
    queryFn: () => apiGet("/admin/google-sync-mass"),
    staleTime: 30_000,
  })

  const paraExecutar = (data?.clientes ?? []).filter(c => c.acao !== "ignorar") // todos: criar + atualizar
  const paraCriar    = (data?.clientes ?? []).filter(c => c.acao === "criar")   // só os novos
  const clientes = (data?.clientes ?? []).filter(c => filtro === "todos" ? true : c.acao === filtro)

  // Token OAuth do Google expirado: detecta pelo preview (persiste após reload)
  // ou pela última sincronização que acabou de falhar por autenticação.
  const jobAuthErro = disparoJob?.tipo === "google-sync" && disparoJob.status !== "running"
    && disparoJob.resultados.some(r => r.status === "erro" && (r.detalhe ?? "").includes("desconectad"))
  const googleDesconectado = !!data?.googleDesconectado || !!jobAuthErro

  function iniciarSync(ids: number[]) {
    if (!ids.length) return
    iniciarGoogleSync(ids)
  }

  return (
    <div className="space-y-5 pt-3 sm:pt-6">
      {/* Cabeçalho da aba */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <GoogleLogo size={18} /> Google Contatos
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Sincronize clientes com a agenda <strong style={{ color: "var(--text-secondary)" }}>bellasu.brecho@gmail.com</strong>
          </p>
        </div>
        {!syncRodando && (
          <button onClick={() => refetch()}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            style={{ border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
            <RefreshCw size={14} /> Atualizar prévia
          </button>
        )}
      </div>

      {/* Aviso: token OAuth expirado — sincronização não funciona até reconectar */}
      {googleDesconectado && (
        <div className="rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)" }}>
          <AlertCircle size={20} className="shrink-0" style={{ color: "#f87171" }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: "#f87171" }}>Google desconectado</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              A autorização expirou — por isso a sincronização falhou. Reconecte, copie o token gerado e cole em <strong>GOOGLE_REFRESH_TOKEN</strong> no Vercel (projeto <strong>brecho-bellasu-v2</strong>), depois faça o redeploy.
            </p>
          </div>
          <a href="/api/google/auth" target="_blank" rel="noopener noreferrer"
            className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white"
            style={{ background: "#f87171" }}>
            <RefreshCw size={14} /> Reconectar Google
          </a>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : data && (
        <>
          {/* Cards de totais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Criar",     value: data.totais.criarNovos, color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.2)"  },
              { label: "Atualizar", value: data.totais.atualizar,  color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
              { label: "Ignorar",   value: data.totais.ignorados,  color: "#64748b", bg: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.15)" },
            ].map(s => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-4 text-center"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Aviso telefone inválido */}
          {data.totais.telInvalido > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs"
              style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
              <AlertCircle size={14} className="shrink-0" />
              <span><strong>{data.totais.telInvalido}</strong> cliente(s) com telefone inválido serão ignorados automaticamente.</span>
            </div>
          )}

          {/* Aviso de sincronização rodando em background */}
          {syncRodando && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl px-5 py-4 flex items-center gap-3 text-sm"
              style={{ background: "rgba(66,133,244,0.08)", border: "1px solid rgba(66,133,244,0.25)" }}>
              <Loader2 size={16} className="animate-spin shrink-0" style={{ color: "#4285F4" }} />
              <span style={{ color: "var(--text-secondary)" }}>
                Sincronizando em segundo plano — acompanhe pelo widget no canto da tela.
              </span>
            </motion.div>
          )}

          {/* Botões de disparo — todos (criar + atualizar) OU só os novos (criar) */}
          {!syncRodando && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => iniciarSync(paraExecutar.map(c => c.id))}
                disabled={paraExecutar.length === 0}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#fff", border: "none" }}>
                <Play size={14} /> Sincronizar todos ({paraExecutar.length})
              </button>
              <button
                onClick={() => iniciarSync(paraCriar.map(c => c.id))}
                disabled={paraCriar.length === 0}
                title="Adiciona ao Google só os clientes ainda não cadastrados, sem alterar os que já existem"
                className="flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.4)" }}>
                <UserPlus size={14} /> Só criar novos ({paraCriar.length})
              </button>
            </div>
          )}

          {/* Filtros da lista */}
          <div className="flex gap-1.5 flex-wrap pt-1">
            {(["todos", "criar", "atualizar", "ignorar"] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize"
                style={{
                  background: filtro === f ? "var(--accent)" : "var(--bg-surface)",
                  color:      filtro === f ? "#fff" : "var(--text-muted)",
                  border:     "1px solid var(--border)",
                }}>
                {f}{f !== "todos" && ` (${(data.clientes ?? []).filter(c => c.acao === f).length})`}
              </button>
            ))}
          </div>

          {/* Lista de clientes */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {clientes.length === 0 ? (
              <div className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Nenhum cliente nesta categoria.
              </div>
            ) : clientes.map((c, i) => (
              <div key={c.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors"
                style={{
                  borderBottom: i < clientes.length - 1 ? "1px solid var(--border)" : "none",
                  background: "var(--bg-card)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-card)" }}>
                {c.status
                  ? (SYNC_STATUS_ICON[c.status] ?? <Clock size={13} className="text-slate-400" />)
                  : <Clock size={13} className="text-slate-400" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.nomeMontado}</p>
                  <p className="text-[11px] truncate" style={{ color: c.telValido ? "var(--text-muted)" : "#f87171" }}>
                    {c.telefone
                      ? `${c.telefone}${!c.telValido && c.telErro ? ` — ${c.telErro}` : ""}`
                      : "sem telefone"}
                  </p>
                </div>
                <span className={cn("text-[10px] font-bold uppercase shrink-0", ACAO_COR[c.acao])}>{c.acao}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Página Principal ──────────────────────────────────────────
export default function ConfiguracoesPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>("empresa")

  const { data, isLoading } = useQuery<EmpresaConfig>({
    queryKey: ["config-empresa"],
    queryFn: () => apiGet("/configuracoes/empresa"),
    staleTime: 300_000,
  })

  const {
    register, handleSubmit, reset,
    formState: { isSubmitting, isDirty },
  } = useForm<EmpresaConfig>({ defaultValues: DEFAULTS })

  useEffect(() => {
    if (data) {
      // Mescla: mantém DEFAULTS para campos vazios vindos da API
      const merged = { ...DEFAULTS, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "")) }
      reset(merged)
    }
  }, [data, reset])

  const salvar = useMutation({
    mutationFn: (values: EmpresaConfig) => apiPost("/configuracoes/empresa", values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config-empresa"] }),
  })

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "empresa",      label: "Empresa",      icon: <Building2 size={14} /> },
    { key: "usuarios",     label: "Usuários",     icon: <Users size={14} /> },
    { key: "integracoes",  label: "Integrações",  icon: <Plug size={14} /> },
    { key: "campanhas",    label: "Campanhas",    icon: <Megaphone size={14} /> },
    { key: "alertas",      label: "Alertas",      icon: <AlertCircle size={14} /> },
    { key: "contatos",     label: "Contatos",     icon: <GoogleLogo size={14} /> },
    { key: "automacoes",   label: "Automações",   icon: <Zap size={14} /> },
  ]

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header + Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-bg)" }}>
            <Building2 size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>Configurações</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Dados da empresa e gestão de usuários</p>
          </div>
        </div>

        {/* Tabs — barra responsiva com scroll horizontal em telas menores */}
        <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", scrollbarWidth: "none" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0"
              style={{
                background: tab === t.key ? "var(--accent)" : "transparent",
                color: tab === t.key ? "#fff" : "var(--text-secondary)",
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <AnimatePresence mode="wait">
        {tab === "empresa" && (
          <motion.div key="empresa" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <form onSubmit={handleSubmit(v => salvar.mutate(v))}>

              {/* ── Grid 2 colunas ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* ── Coluna esquerda: Dados da Empresa + Endereço ── */}
                <div className="rounded-2xl p-6 space-y-4"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2"
                    style={{ color: "var(--text-muted)" }}>
                    <Building2 size={12} /> Dados da Empresa
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelClass} style={{ color: "var(--text-muted)" }}>Razão Social *</label>
                      <input {...register("razao_social")} className={iBase} style={iSt} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelClass} style={{ color: "var(--text-muted)" }}>Nome Fantasia</label>
                      <input {...register("nome_fantasia")} className={iBase} style={iSt} />
                    </div>
                    <div>
                      <label className={labelClass} style={{ color: "var(--text-muted)" }}>CNPJ</label>
                      <input {...register("cnpj")} className={iBase} style={iSt} placeholder="00.000.000/0000-00" />
                    </div>
                    <div>
                      <label className={labelClass} style={{ color: "var(--text-muted)" }}>Inscrição Estadual</label>
                      <input {...register("ie")} className={iBase} style={iSt} placeholder="ISENTO" />
                    </div>
                    <div>
                      <label className={labelClass} style={{ color: "var(--text-muted)" }}>Telefone</label>
                      <input {...register("telefone")} className={iBase} style={iSt} placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                      <label className={labelClass} style={{ color: "var(--text-muted)" }}>E-mail</label>
                      <input type="email" {...register("email")} className={iBase} style={iSt} />
                    </div>
                  </div>

                  {/* Endereço */}
                  <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <h3 className="font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-2"
                      style={{ color: "var(--text-muted)" }}>
                      📍 Endereço
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass} style={{ color: "var(--text-muted)" }}>CEP</label>
                        <input {...register("cep")} className={iBase} style={iSt} placeholder="00000-000" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass} style={{ color: "var(--text-muted)" }}>Logradouro</label>
                        <input {...register("logradouro")} className={iBase} style={iSt} />
                      </div>
                      <div>
                        <label className={labelClass} style={{ color: "var(--text-muted)" }}>Número</label>
                        <input {...register("numero")} className={iBase} style={iSt} />
                      </div>
                      <div>
                        <label className={labelClass} style={{ color: "var(--text-muted)" }}>Complemento</label>
                        <input {...register("complemento")} className={iBase} style={iSt} placeholder="Sala, Loja..." />
                      </div>
                      <div>
                        <label className={labelClass} style={{ color: "var(--text-muted)" }}>Bairro</label>
                        <input {...register("bairro")} className={iBase} style={iSt} />
                      </div>
                      <div className="col-span-2">
                        <label className={labelClass} style={{ color: "var(--text-muted)" }}>Cidade</label>
                        <input {...register("cidade")} className={iBase} style={iSt} />
                      </div>
                      <div>
                        <label className={labelClass} style={{ color: "var(--text-muted)" }}>UF</label>
                        <input {...register("estado")} maxLength={2} className={iBase} style={iSt} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Coluna direita: Regime Tributário + PIX + Salvar ── */}
                <div className="rounded-2xl p-6 space-y-4"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2"
                    style={{ color: "var(--text-muted)" }}>
                    📋 Regime & PIX
                  </h3>

                  {/* Regime Tributário */}
                  <div>
                    <label className={labelClass} style={{ color: "var(--text-muted)" }}>Regime Tributário</label>
                    <select {...register("regime_tributario")} className={iBase} style={iSt}>
                      {REGIME_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  {/* PIX */}
                  <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <h3 className="font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-2"
                      style={{ color: "var(--text-muted)" }}>
                      💳 PIX
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass} style={{ color: "var(--text-muted)" }}>Tipo de chave</label>
                        <select {...register("pix_tipo")} className={iBase} style={iSt}>
                          <option value="">Selecione</option>
                          {["CPF","CNPJ","E-mail","Telefone","Chave aleatória"].map(t =>
                            <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass} style={{ color: "var(--text-muted)" }}>Nome do titular</label>
                        <input {...register("pix_titular")} className={iBase} style={iSt} />
                      </div>
                      <div className="col-span-2">
                        <label className={labelClass} style={{ color: "var(--text-muted)" }}>Chave PIX</label>
                        <input {...register("pix_chave")} className={iBase} style={iSt} />
                      </div>
                    </div>
                  </div>

                  {/* Botão salvar */}
                  <div className="pt-4 flex items-center gap-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <button type="submit" disabled={isSubmitting || !isDirty}
                      className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl text-white transition-opacity disabled:opacity-50"
                      style={{ background: "var(--accent)" }}>
                      {isSubmitting
                        ? <><Loader2 size={15} className="animate-spin" />Salvando...</>
                        : <><Save size={15} />Salvar Configurações</>}
                    </button>
                    <AnimatePresence>
                      {salvar.isSuccess && (
                        <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-1 text-sm font-medium" style={{ color: "#4ade80" }}>
                          <Check size={14} /> Salvo com sucesso!
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </form>
          </motion.div>
        )}

        {tab === "usuarios" && (
          <motion.div key="usuarios" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AbaUsuarios />
          </motion.div>
        )}

        {tab === "integracoes" && (
          <motion.div key="integracoes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AbaIntegracoes />
          </motion.div>
        )}

        {tab === "alertas" && (
          <motion.div key="alertas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AbaAlertas />
          </motion.div>
        )}

        {tab === "campanhas" && (
          <motion.div key="campanhas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <CampanhaWhatsApp />
          </motion.div>
        )}

        {tab === "contatos" && (
          <motion.div key="contatos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AbaGoogle />
          </motion.div>
        )}

        {tab === "automacoes" && (
          <motion.div key="automacoes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AbaAutomacoes />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Campanha WhatsApp — card completo (Escrever + Histórico)
// ══════════════════════════════════════════════════════════

const EMOJI_PICKER = [
  {
    icon: "⚡", label: "Rápidos",
    emojis: ["😍","🌸","💖","✨","🛍️","💫","🎀","🌺","💌","🎉","👗","💕","🤩","🏷️","👠","💅","🌟","🥰","💎","🛒","🎊","🥳","💃","👑","🫶"],
  },
  {
    icon: "😊", label: "Expressões",
    emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉","😊","😇","🥰","😍","🤩","😘","☺️","😋","😛","😜","🤪","🤗","🤭","🤫","🤔","😐","😏","😒","🙄","😬","😔","😪","😴","😷","😎","🤓","🥺","😢","😭","😤","😡","🥹","🫠","🤭","🥸","🤯","😵","😈","👿","🙊","🙉","🙈"],
  },
  {
    icon: "❤️", label: "Amor",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","❤️‍🔥","💕","💞","💓","💗","💖","💘","💝","💟","😻","🫶","💑","👫","💏","🌹","🌷","💐","🫦","💋","😘","🥰"],
  },
  {
    icon: "🎉", label: "Celebração",
    emojis: ["🎉","🎊","🎈","🎁","🎀","🏆","🥇","🌟","⭐","✨","💫","🎆","🎇","🪄","🎂","🥂","🍾","🎶","🎵","🎤","🥳","🎸","🪅","🎭","🎪","🥁","🎺","🎻","🎹","🎠","🎡"],
  },
  {
    icon: "👗", label: "Moda",
    emojis: ["👗","👘","🥻","🩱","🩲","🩳","👙","👚","👛","👜","👝","🎒","🧣","🧤","🧥","👞","👟","🥿","👠","👡","👢","🩴","👒","🎩","💄","💅","💍","💎","🪮","✂️","🛍️","🏷️","👑","🪭","🕶️","🪬","🧴","🪞"],
  },
  {
    icon: "🌸", label: "Natureza",
    emojis: ["🌸","🌺","🌻","🌹","🌷","🪷","💐","🌿","🍃","🍀","🌱","🌲","🌳","🌴","🌵","🌾","🍁","🍂","🦋","🐝","🌙","⭐","☀️","🌈","❄️","🌊","🌼","🪻","🌬️","🌤️","🌞","🌝","🪐","🌏","🌺","🌻"],
  },
  {
    icon: "💬", label: "Extras",
    emojis: ["✅","❌","⚠️","ℹ️","🔔","📢","📣","💬","💭","📱","📸","📌","📍","💡","🔥","⚡","🎯","🔑","✍️","📝","🔗","📊","🗓️","🕐","💯","🔴","🟢","🟡","🆕","🆓","🔝","⬆️","📲","🤳","🛎️","📬","🗣️"],
  },
]

interface Campanha {
  id: number
  texto: string
  midia_tipo: "imagem" | "video" | null
  midia_url: string | null
  midia_nome: string | null
  status: "rascunho" | "enviada" | "enviando"
  total_clientes: number
  enviadas: number
  erros: number
  criado_em: string
  enviado_em: string | null
}

function BalaoErro({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 340, damping: 24 }}
      className="flex items-start gap-3 rounded-2xl p-4 mb-3"
      style={{ background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.3)" }}
    >
      {/* Ilustração animada */}
      <motion.div
        animate={{ rotate: [0, -8, 8, -6, 6, 0] }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="shrink-0 text-2xl select-none"
      >⚠️</motion.div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wider mb-0.5" style={{ color: "#ef4444" }}>Atenção</p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{msg}</p>
      </div>
      <button onClick={onClose} className="shrink-0 p-0.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity">
        <X size={13} style={{ color: "var(--text-muted)" }} />
      </button>
    </motion.div>
  )
}

function PreviewWhatsApp({ texto, midiaTipo, midiaUrl, nomeExemplo = "Maria" }: {
  texto: string; midiaTipo: "imagem" | "video" | null; midiaUrl: string | null; nomeExemplo?: string
}) {
  const saudacoes = [
    `Oi, ${nomeExemplo}! 😍 Passando aqui com uma novidade especial pra você!`,
    `Oiii ${nomeExemplo}! 🌸 Temos algo lindo esperando por você no Brechó Bellasu!`,
  ]
  const saudacao = saudacoes[Math.floor(Date.now() / 10000) % saudacoes.length]
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0b141a" }}>
      {/* Header fake WhatsApp */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#1f2c34" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: "#25d366" }}>🛍️</div>
        <div>
          <p className="text-[11px] font-bold" style={{ color: "#e9edef" }}>Brechó Bellasu</p>
          <p className="text-[9px]" style={{ color: "#8696a0" }}>online</p>
        </div>
      </div>
      {/* Fundo de chat */}
      <div className="px-4 py-4 min-h-[120px]" style={{ background: "#0b141a" }}>
        {texto || midiaUrl ? (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm overflow-hidden"
              style={{ background: "#005c4b" }}>
              {/* Mídia preview */}
              {midiaUrl && midiaTipo === "imagem" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={midiaUrl} alt="preview" className="w-full max-h-40 object-cover" />
              )}
              {midiaUrl && midiaTipo === "video" && (
                <div className="flex items-center justify-center w-full h-24 gap-2"
                  style={{ background: "rgba(0,0,0,0.3)" }}>
                  <Video size={20} style={{ color: "#e9edef" }} />
                  <span className="text-xs" style={{ color: "#e9edef" }}>Vídeo</span>
                </div>
              )}
              {/* Texto */}
              {(texto) && (
                <div className="px-3 py-2">
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "#e9edef" }}>
                    <span style={{ color: "#25d366" }}>{saudacao}{"\n\n"}</span>
                    {texto}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[9px]" style={{ color: "#8696a0" }}>{hora}</span>
                    <span className="text-[10px]" style={{ color: "#53bdeb" }}>✓✓</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-3 select-none">
            <motion.div
              animate={{ scale: [1, 1.08, 1], rotate: [0, -4, 4, 0] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}>
              <span className="text-3xl">💬</span>
            </motion.div>
            <div className="text-center">
              <p className="text-[11px] font-bold mb-0.5" style={{ color: "#8696a0" }}>Escreva sua mensagem</p>
              <p className="text-[9px]" style={{ color: "#4a5568" }}>O preview aparece aqui</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CampanhaWhatsApp() {
  type Aba = "escrever" | "historico"
  const [aba, setAba] = useState<Aba>("escrever")

  // Composer
  const [texto, setTexto] = useState("")
  const [midiaTipo, setMidiaTipo] = useState<"imagem" | "video" | null>(null)
  const [midiaUrl, setMidiaUrl] = useState<string | null>(null)
  const [midiaNome, setMidiaNome] = useState<string | null>(null)
  const [midiaLocalUrl, setMidiaLocalUrl] = useState<string | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [catEmojiIdx, setCatEmojiIdx] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)

  // IA — melhorar texto
  const [melhorando, setMelhorando] = useState(false)
  const [textoAnterior, setTextoAnterior] = useState<string | null>(null)
  const [mostrarDesfazer, setMostrarDesfazer] = useState(false)

  // Confirmação de disparo
  const [modalDisparo, setModalDisparo] = useState(false)
  const [fila, setFila] = useState<{ total: number; duracaoMinMin: number; duracaoMinMax: number } | null>(null)
  const [carregandoFila, setCarregandoFila] = useState(false)

  // Histórico
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [carregandoHist, setCarregandoHist] = useState(false)
  const [excluindo, setExcluindo] = useState<number | null>(null)

  const iniciarBroadcast = useDisparoStore(s => s.iniciarBroadcast)
  const jobRodando = useDisparoStore(s => s.job?.status === "running")

  function limparComposer() {
    setTexto(""); setMidiaTipo(null); setMidiaUrl(null); setMidiaNome(null)
    setMidiaLocalUrl(null); setEditandoId(null); setErro(null)
  }

  // Carrega histórico ao entrar na aba
  useEffect(() => {
    if (aba === "historico") carregarHistorico()
  }, [aba])

  async function carregarHistorico() {
    setCarregandoHist(true)
    try {
      const r = await apiGet<{ campanhas: Campanha[] }>("/admin/campanhas")
      setCampanhas(r.campanhas ?? [])
    } catch { /* silencioso */ }
    finally { setCarregandoHist(false) }
  }

  async function melhorarTexto() {
    if (!texto.trim() || melhorando) return
    setMelhorando(true)
    setErro(null)
    try {
      const res = await fetch("/api/admin/campanhas/melhorar-texto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      })
      const json = await res.json() as { texto?: string; erro?: string }
      if (!res.ok || json.erro) { setErro(json.erro ?? "Não foi possível melhorar o texto. Tente novamente."); return }
      if (json.texto) {
        setTextoAnterior(texto)
        setTexto(json.texto)
        setMostrarDesfazer(true)
        setTimeout(() => setMostrarDesfazer(false), 6000)
      }
    } catch { setErro("Falha de conexão com a IA. Verifique sua internet e tente novamente.") }
    finally { setMelhorando(false) }
  }

  function desfazerMelhora() {
    if (textoAnterior !== null) { setTexto(textoAnterior); setTextoAnterior(null) }
    setMostrarDesfazer(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setErro(null)

    // Validação client-side imediata
    const MAX = 16 * 1024 * 1024
    const isVideo = file.type.startsWith("video/")
    const isImagem = file.type.startsWith("image/")
    if (!isVideo && !isImagem) {
      setErro("Tipo não suportado. Envie JPG, PNG, WebP, GIF, MP4, MOV ou WebM.")
      return
    }
    if (file.size > MAX) {
      const mb = (file.size / 1024 / 1024).toFixed(1)
      setErro(`Arquivo muito grande: ${mb} MB. O limite é 16 MB. Comprima o vídeo/imagem e tente novamente.`)
      return
    }

    setMidiaLocalUrl(URL.createObjectURL(file))
    setMidiaTipo(isVideo ? "video" : "imagem")
    setMidiaNome(file.name)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/campanhas/upload", { method: "POST", body: fd })
      const json = await res.json() as { url?: string; erro?: string }
      if (!res.ok || json.erro) { setErro(json.erro ?? "Falha no upload."); setMidiaLocalUrl(null); setMidiaTipo(null); return }
      setMidiaUrl(json.url ?? null)
    } catch {
      setErro("Falha de rede no upload. Verifique sua conexão e tente novamente.")
      setMidiaLocalUrl(null); setMidiaTipo(null)
    } finally {
      setUploading(false)
    }
  }

  function removerMidia() {
    setMidiaTipo(null); setMidiaUrl(null); setMidiaNome(null); setMidiaLocalUrl(null)
  }

  async function salvarRascunho() {
    if (!texto.trim()) { setErro("Escreva uma mensagem antes de salvar."); return }
    setSalvando(true); setErro(null)
    try {
      await apiPost("/admin/campanhas", { id: editandoId ?? undefined, texto, midia_tipo: midiaTipo, midia_url: midiaUrl, midia_nome: midiaNome })
      limparComposer()
      setAba("historico")
      await carregarHistorico()
    } catch { setErro("Falha ao salvar rascunho. Tente novamente.") }
    finally { setSalvando(false) }
  }

  async function abrirModalDisparo() {
    if (!texto.trim()) { setErro("Escreva uma mensagem antes de disparar."); return }
    if (uploading) { setErro("Aguarde o upload da mídia terminar."); return }
    setCarregandoFila(true); setErro(null)
    try {
      const r = await apiGet<{ total: number; duracaoMinMin: number; duracaoMinMax: number }>("/admin/broadcast")
      setFila(r); setModalDisparo(true)
    } catch { setErro("Não foi possível carregar a lista de clientes.") }
    finally { setCarregandoFila(false) }
  }

  async function confirmarDisparo() {
    setSalvando(true)
    try {
      // Salva/atualiza campanha com status "enviando"
      const r = await apiPost<{ campanha: Campanha }>("/admin/campanhas", {
        id: editandoId ?? undefined,
        texto, midia_tipo: midiaTipo, midia_url: midiaUrl, midia_nome: midiaNome,
      })
      const campanhaId = r.campanha.id
      const titulo = texto.slice(0, 40) + (texto.length > 40 ? "…" : "")
      const ok = iniciarBroadcast({ campanhaId, campanhaTitulo: titulo })
      if (!ok) { setErro("Já existe um envio em andamento. Aguarde terminar."); return }
      setModalDisparo(false)
      limparComposer()
      setAba("historico")
      await carregarHistorico()
    } catch { setErro("Falha ao iniciar disparo.") }
    finally { setSalvando(false) }
  }

  function editarCampanha(c: Campanha) {
    setTexto(c.texto)
    setMidiaTipo(c.midia_tipo)
    setMidiaUrl(c.midia_url)
    setMidiaNome(c.midia_nome)
    setMidiaLocalUrl(c.midia_url)
    setEditandoId(c.id)
    setAba("escrever")
  }

  async function excluirCampanha(id: number) {
    setExcluindo(id)
    try {
      await apiDelete(`/admin/campanhas?id=${id}`)
      setCampanhas(prev => prev.filter(c => c.id !== id))
    } catch { setErro("Falha ao excluir.") }
    finally { setExcluindo(null) }
  }

  const charCount = texto.length
  const iBase = "w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all border focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1.5px solid rgba(37,211,102,0.25)" }}>
      {/* Header do card */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ background: "rgba(37,211,102,0.06)", borderBottom: "1px solid rgba(37,211,102,0.15)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,211,102,0.12)" }}>
          <Megaphone size={17} style={{ color: "#25d366" }} />
        </div>
        <div className="flex-1">
          <h3 className="font-black text-sm" style={{ color: "var(--text-primary)" }}>Campanha WhatsApp</h3>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Disparo em massa para clientes que autorizaram</p>
        </div>
        {/* Abas */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-surface)" }}>
          {([["escrever", PenLine, "Escrever"], ["historico", History, "Histórico"]] as const).map(([k, Icon, label]) => (
            <button key={k} onClick={() => setAba(k)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={{
                background: aba === k ? "var(--accent)" : "transparent",
                color: aba === k ? "#fff" : "var(--text-muted)",
              }}>
              <Icon size={11} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait">
          {/* ── ABA ESCREVER ── */}
          {aba === "escrever" && (
            <motion.div key="escrever" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              {editandoId && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold"
                  style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "var(--accent)" }}>
                  <Pencil size={11} />Editando rascunho #{editandoId}
                  <button onClick={limparComposer} className="ml-auto opacity-60 hover:opacity-100"><X size={11} /></button>
                </div>
              )}

              {/* Erros */}
              <AnimatePresence>
                {erro && <BalaoErro key="erro" msg={erro} onClose={() => setErro(null)} />}
              </AnimatePresence>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Coluna esquerda: composer */}
                <div className="space-y-3">
                  {/* Textarea */}
                  <div className="relative">
                    <textarea
                      value={texto}
                      onChange={e => { setTexto(e.target.value); setMostrarDesfazer(false) }}
                      placeholder="Escreva a mensagem da campanha… (a saudação é adicionada automaticamente por cliente)"
                      rows={5}
                      maxLength={800}
                      className={`${iBase} resize-none pb-11 no-uppercase`}
                      style={{
                        ...iSt,
                        fontFamily: "inherit",
                        borderColor: melhorando ? "var(--accent)" : undefined,
                        transition: "border-color 0.3s",
                        boxShadow: melhorando ? "0 0 0 2px rgba(99,102,241,0.15)" : undefined,
                      }}
                    />
                    {/* Rodapé da textarea: Sparkles (esquerda) + contador (direita) */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {/* Botão IA */}
                        <button
                          type="button"
                          onClick={melhorarTexto}
                          disabled={!texto.trim() || melhorando}
                          title="Melhorar texto com IA"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            background: melhorando ? "rgba(99,102,241,0.22)" : "rgba(99,102,241,0.14)",
                            color: "var(--accent)",
                            border: "1px solid rgba(99,102,241,0.45)",
                            boxShadow: "0 1px 3px rgba(99,102,241,0.15)",
                          }}
                        >
                          {melhorando
                            ? <><Loader2 size={12} className="animate-spin" />Melhorando…</>
                            : <><Sparkles size={12} />Melhorar com IA</>
                          }
                        </button>

                        {/* Botão Desfazer — aparece por 6s após melhorar */}
                        <AnimatePresence>
                          {mostrarDesfazer && (
                            <motion.button
                              type="button"
                              onClick={desfazerMelhora}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -4 }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold"
                              style={{ background: "rgba(245,158,11,0.14)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)", boxShadow: "0 1px 3px rgba(245,158,11,0.15)" }}
                            >
                              <Undo2 size={12} />Desfazer
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </div>

                      <span className="text-[10px]" style={{ color: charCount > 700 ? "#ef4444" : "var(--text-muted)" }}>
                        {charCount}/800
                      </span>
                    </div>
                  </div>

                  {/* Emoji Picker Completo */}
                  <div>
                    <button onClick={() => setShowEmoji(v => !v)}
                      className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                      style={{
                        background: showEmoji ? "rgba(99,102,241,0.12)" : "var(--bg-surface)",
                        color: showEmoji ? "var(--accent)" : "var(--text-muted)",
                        border: `1px solid ${showEmoji ? "var(--accent)" : "var(--border)"}`,
                      }}>
                      <Smile size={12} />
                      {showEmoji ? "Fechar emojis" : "😊 Emojis"}
                    </button>
                    <AnimatePresence>
                      {showEmoji && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.97 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28 }}
                          className="mt-2 rounded-2xl overflow-hidden"
                          style={{ border: "1.5px solid var(--border)", background: "var(--bg-card)" }}>
                          {/* Tabs de categoria */}
                          <div className="flex gap-1 p-2 overflow-x-auto"
                            style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                            {EMOJI_PICKER.map((cat, i) => (
                              <button key={cat.icon}
                                onClick={() => setCatEmojiIdx(i)}
                                title={cat.label}
                                className="shrink-0 w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all"
                                style={{
                                  background: catEmojiIdx === i ? "rgba(99,102,241,0.18)" : "transparent",
                                  outline: catEmojiIdx === i ? "1.5px solid rgba(99,102,241,0.4)" : "none",
                                  transform: catEmojiIdx === i ? "scale(1.15)" : "scale(1)",
                                }}>
                                {cat.icon}
                              </button>
                            ))}
                          </div>
                          {/* Label da categoria */}
                          <div className="px-3 pt-2 pb-1">
                            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                              {EMOJI_PICKER[catEmojiIdx].label}
                            </p>
                          </div>
                          {/* Grid de emojis */}
                          <div className="px-2 pb-2 grid grid-cols-9 gap-0.5 max-h-40 overflow-y-auto"
                            style={{ scrollbarWidth: "thin" }}>
                            {EMOJI_PICKER[catEmojiIdx].emojis.map(e => (
                              <button key={e}
                                onClick={() => setTexto(t => t + e)}
                                className="w-8 h-8 text-lg flex items-center justify-center rounded-lg select-none transition-all"
                                onMouseEnter={ev => { ev.currentTarget.style.background = "var(--bg-hover)"; ev.currentTarget.style.transform = "scale(1.25)" }}
                                onMouseLeave={ev => { ev.currentTarget.style.background = "transparent"; ev.currentTarget.style.transform = "scale(1)" }}>
                                {e}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Mídia */}
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                      Mídia (opcional — 1 imagem OU 1 vídeo · máx <span className="font-black text-amber-400">16 MB</span>)
                    </label>
                    {!midiaTipo ? (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col items-center gap-1.5 p-4 rounded-xl cursor-pointer transition-all"
                          style={{ background: "var(--bg-surface)", border: "1.5px dashed var(--border)" }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                          <ImageIcon size={20} style={{ color: "var(--text-muted)" }} />
                          <span className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>Imagem</span>
                          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>JPG, PNG, WebP, GIF</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                        </label>
                        <label className="flex flex-col items-center gap-1.5 p-4 rounded-xl cursor-pointer transition-all"
                          style={{ background: "var(--bg-surface)", border: "1.5px dashed var(--border)" }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                          <Video size={20} style={{ color: "var(--text-muted)" }} />
                          <span className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>Vídeo</span>
                          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>MP4, MOV, WebM · máx 16 MB</span>
                          <input type="file" accept="video/*" className="hidden" onChange={handleUpload} />
                        </label>
                      </div>
                    ) : (
                      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                        className="relative rounded-xl overflow-hidden"
                        style={{ border: "1.5px solid rgba(37,211,102,0.35)", background: "var(--bg-surface)" }}>
                        {uploading && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
                            style={{ background: "rgba(0,0,0,0.6)" }}>
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 size={20} className="animate-spin" style={{ color: "#25d366" }} />
                              <span className="text-xs font-bold text-white">Enviando…</span>
                            </div>
                          </div>
                        )}
                        {midiaTipo === "imagem" && midiaLocalUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={midiaLocalUrl} alt="preview" className="w-full max-h-36 object-cover" />
                        )}
                        {midiaTipo === "video" && (
                          <div className="flex items-center gap-3 p-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,211,102,0.12)" }}>
                              <Video size={18} style={{ color: "#25d366" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>{midiaNome}</p>
                              <p className="text-[10px]" style={{ color: "#25d366" }}>
                                {uploading ? "Enviando…" : midiaUrl ? "✓ Upload concluído" : "Processando…"}
                              </p>
                            </div>
                          </div>
                        )}
                        <button onClick={removerMidia}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(239,68,68,0.85)" }}>
                          <X size={12} color="#fff" />
                        </button>
                      </motion.div>
                    )}
                  </div>

                  {/* Botões */}
                  <div className="flex gap-2 pt-1">
                    <button onClick={salvarRascunho} disabled={salvando || !texto.trim()}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      {salvando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      Salvar rascunho
                    </button>
                    <button onClick={abrirModalDisparo} disabled={jobRodando || !texto.trim() || uploading || carregandoFila}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg,#25d366,#128c7e)" }}>
                      {carregandoFila ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Disparar campanha
                    </button>
                  </div>
                  {jobRodando && (
                    <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
                      Aguarde o envio atual terminar antes de iniciar outro.
                    </p>
                  )}
                </div>

                {/* Coluna direita: preview */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Preview — como a cliente vai receber
                  </p>
                  <PreviewWhatsApp texto={texto} midiaTipo={midiaTipo} midiaUrl={midiaLocalUrl ?? midiaUrl} />
                  <p className="text-[9px] text-center" style={{ color: "var(--text-muted)" }}>
                    A saudação varia por cliente (anti-bloqueio automático)
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── ABA HISTÓRICO ── */}
          {aba === "historico" && (
            <motion.div key="historico" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <AnimatePresence>
                {erro && <BalaoErro key="erro" msg={erro} onClose={() => setErro(null)} />}
              </AnimatePresence>

              {carregandoHist ? (
                <div className="flex items-center justify-center py-12 gap-3">
                  <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Carregando histórico…</span>
                </div>
              ) : campanhas.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-12 gap-3">
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}>
                    <span className="text-5xl select-none">📭</span>
                  </motion.div>
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Nenhuma campanha ainda</p>
                  <p className="text-xs text-center max-w-xs" style={{ color: "var(--text-muted)" }}>
                    Escreva sua primeira campanha e os rascunhos e histórico de envios aparecerão aqui.
                  </p>
                  <button onClick={() => setAba("escrever")}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white mt-1"
                    style={{ background: "#25d366" }}>
                    <PenLine size={13} /> Criar campanha
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {campanhas.map((c, i) => (
                    <motion.div key={c.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-xl p-4"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                      <div className="flex items-start gap-3">
                        {/* Badge status */}
                        <div className="shrink-0 mt-0.5">
                          {c.status === "rascunho" ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>RASCUNHO</span>
                          ) : c.status === "enviando" ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1" style={{ background: "rgba(99,102,241,0.12)", color: "var(--accent)" }}>
                              <Loader2 size={9} className="animate-spin" />ENVIANDO
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg" style={{ background: "rgba(37,211,102,0.12)", color: "#25d366" }}>ENVIADA</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold line-clamp-2 mb-1" style={{ color: "var(--text-primary)" }}>{c.texto || "(sem texto)"}</p>
                          <div className="flex flex-wrap items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {c.midia_tipo && (
                              <span className="flex items-center gap-1">
                                {c.midia_tipo === "imagem" ? <ImageIcon size={10} /> : <Video size={10} />}
                                {c.midia_tipo}
                              </span>
                            )}
                            {c.status === "enviada" && (
                              <>
                                <span className="flex items-center gap-1"><Users2 size={10} />{c.total_clientes} clientes</span>
                                <span style={{ color: "#25d366" }}>✓ {c.enviadas} enviadas</span>
                                {c.erros > 0 && <span style={{ color: "#ef4444" }}>✗ {c.erros} erros</span>}
                              </>
                            )}
                            <span className="flex items-center gap-1">
                              <Timer size={10} />
                              {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => editarCampanha(c)} title="Editar"
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => excluirCampanha(c.id)} disabled={excluindo === c.id} title="Excluir"
                            className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#ef4444" }}
                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}>
                            {excluindo === c.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal de confirmação de disparo */}
      <AnimatePresence>
        {modalDisparo && fila && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
            onClick={() => setModalDisparo(false)}>
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="w-full max-w-sm rounded-3xl overflow-hidden"
              style={{ background: "var(--bg-card)", border: "1.5px solid rgba(37,211,102,0.3)" }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4"
                style={{ background: "rgba(37,211,102,0.06)", borderBottom: "1px solid rgba(37,211,102,0.15)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">📣</span>
                  <span className="font-black text-sm" style={{ color: "#25d366" }}>Confirmar disparo</span>
                </div>
                <button onClick={() => setModalDisparo(false)}>
                  <X size={15} style={{ color: "var(--text-muted)" }} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Contagem animada */}
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                  className="text-center py-4 rounded-2xl"
                  style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.2)" }}>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="text-5xl font-black" style={{ color: "#25d366" }}>{fila.total}</motion.p>
                  <p className="text-xs mt-1 font-bold" style={{ color: "var(--text-muted)" }}>clientes com WhatsApp autorizado</p>
                </motion.div>

                {/* Estimativa */}
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <Timer size={15} style={{ color: "var(--accent)" }} />
                  <div>
                    <p className="text-[11px] font-bold" style={{ color: "var(--text-primary)" }}>Tempo estimado</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      ~{fila.duracaoMinMin}–{fila.duracaoMinMax} min com intervalo seguro entre envios
                    </p>
                  </div>
                </div>

                {/* Aviso LGPD */}
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <ShieldCheck size={14} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    Disparo apenas para clientes que autorizaram receber mensagens. Intervalo imprevisível de 80–150s entre cada envio para proteção da conta.
                  </p>
                </div>

                {/* Botões */}
                <div className="flex gap-2">
                  <button onClick={() => setModalDisparo(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold"
                    style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                    Cancelar
                  </button>
                  <button onClick={confirmarDisparo} disabled={salvando}
                    className="flex-1 py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#25d366,#128c7e)" }}>
                    {salvando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Disparar agora
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Aba Alertas ─────────────────────────────────────────
function AbaAlertas() {
  const [num1, setNum1] = useState("")
  const [num2, setNum2] = useState("")
  const [followupAtivo, setFollowupAtivo] = useState(true)
  const [followupHoras, setFollowupHoras] = useState("24")
  const [followupMax, setFollowupMax] = useState("1")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  // Carrega configurações
  useEffect(() => {
    apiGet("/configuracoes/alertas").then((data) => {
      const d = data as Record<string, string>
      setNum1(d.alerta_numero_1 ?? "")
      setNum2(d.alerta_numero_2 ?? "")
      setFollowupAtivo(d.consentimento_followup_ativo !== "false")
      setFollowupHoras(d.consentimento_followup_horas ?? "24")
      setFollowupMax(d.consentimento_followup_max ?? "1")
    }).catch(() => {})
  }, [])

  async function salvar() {
    setSaving(true); setMsg("")
    try {
      await import("@/services/api").then(m => m.apiPut("/configuracoes/alertas", {
        alerta_numero_1: num1.replace(/\D/g, ""),
        alerta_numero_2: num2.replace(/\D/g, ""),
        consentimento_followup_ativo: followupAtivo ? "true" : "false",
        consentimento_followup_horas: followupHoras,
        consentimento_followup_max: followupMax,
      }))
      setMsg("✅ Números salvos!")
    } catch { setMsg("❌ Erro ao salvar.") }
    finally { setSaving(false) }
  }

  const iBase = "w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all border focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }

  return (
    <div className="space-y-6">
      {/* Números de alerta */}
      <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle size={16} style={{ color: "#f59e0b" }} />
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Alertas Financeiros</h3>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Números que recebem alertas de contas a vencer via WhatsApp (todo dia às 8h).
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
              Número 1 (obrigatório)
            </label>
            <input value={num1} onChange={e => setNum1(e.target.value)} placeholder="16991347476" className={iBase} style={iSt} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
              Número 2 (opcional)
            </label>
            <input value={num2} onChange={e => setNum2(e.target.value)} placeholder="16999999999" className={iBase} style={iSt} />
          </div>
        </div>
        <div className="mt-5 rounded-2xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h4 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Follow-up de consentimento</h4>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Reenvia uma mensagem para novos clientes que ainda nÃ£o responderam SIM ou NÃƒO.
              </p>
            </div>
            <button type="button" onClick={() => setFollowupAtivo(v => !v)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
              style={{ background: followupAtivo ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)", color: followupAtivo ? "#10b981" : "var(--text-muted)" }}>
              {followupAtivo ? "Ativo" : "Inativo"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                Aguardar horas
              </label>
              <input type="number" min="1" value={followupHoras} onChange={e => setFollowupHoras(e.target.value)} className={iBase} style={iSt} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                MÃ¡ximo de follow-ups
              </label>
              <input type="number" min="0" value={followupMax} onChange={e => setFollowupMax(e.target.value)} className={iBase} style={iSt} />
            </div>
          </div>
        </div>

        <button onClick={salvar} disabled={saving}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar números
        </button>
        {msg && <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>{msg}</p>}

        {/* Disparo manual — consentimentos não enviados */}
        <DisparoConsentimentoNaoEnviado />
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════
// Disparo manual de consentimento para clientes não enviados
// ══════════════════════════════════════════════════════════
function DisparoConsentimentoNaoEnviado() {
  type Fase = "idle" | "carregando" | "confirmando"
  type Item = { id: number; nome: string }

  const [fase, setFase] = useState<Fase>("idle")
  const [clientes, setClientes] = useState<Item[]>([])
  const iniciarConsentimento = useDisparoStore(s => s.iniciarConsentimento)
  const jobRodando = useDisparoStore(s => s.job?.status === "running")

  async function carregar() {
    setFase("carregando")
    try {
      const res = await apiGet<{ total: number; clientes: Item[] }>("/admin/consentimento-nao-enviado")
      setClientes(res.clientes ?? [])
      setFase("confirmando")
    } catch { setFase("idle") }
  }

  // Enfileira o disparo no store global e fecha o modal. O envio roda em
  // segundo plano (widget flutuante), com intervalo seguro entre cada
  // mensagem — o operador continua usando o sistema normalmente.
  function disparar() {
    const ok = iniciarConsentimento()
    if (!ok) return   // já há um envio em andamento
    fechar()
  }

  function fechar() { setFase("idle"); setClientes([]) }

  return (
    <>
      <div className="mt-5 rounded-2xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Disparar consentimentos não enviados</h4>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Envia o consentimento inicial para clientes que ainda não receberam, com intervalo de 80–150s entre cada envio.
            </p>
          </div>
          <button onClick={carregar} disabled={fase !== "idle" || jobRodando}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
            style={{ background: "#7c3aed" }}>
            {fase === "carregando" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Disparar
          </button>
        </div>
        {jobRodando && (
          <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
            Já existe um envio em andamento (veja o indicador no canto da tela). Aguarde terminar para iniciar outro.
          </p>
        )}
      </div>

      {/* Modal de confirmação */}
      <AnimatePresence>
        {fase === "confirmando" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
            <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="font-bold text-sm" style={{ color: "#7c3aed" }}>Disparo de Consentimento</span>
                <button onClick={fechar}><X size={16} style={{ color: "var(--text-muted)" }} /></button>
              </div>

              <div className="p-5 space-y-4">
                {clientes.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: "#10b981" }} />
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Nenhuma cliente pendente!</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Todas as clientes já receberam o consentimento.</p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-3 rounded-xl text-center" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
                      <p className="text-2xl font-bold" style={{ color: "#7c3aed" }}>{clientes.length}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>clientes sem consentimento enviado</p>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Intervalo de <strong>80 a 150 segundos</strong> entre cada envio. Tempo estimado: <strong>~{Math.round(clientes.length * 115 / 60)} minutos</strong>. O envio roda em segundo plano — você pode continuar usando o sistema.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={fechar} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--bg-base)", color: "var(--text-secondary)" }}>
                        Cancelar
                      </button>
                      <button onClick={disparar} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#7c3aed" }}>
                        <Send size={13} className="inline mr-1.5" />Disparar Agora
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Aba Automações ──────────────────────────────────────
interface AutomacaoDef {
  id: string
  grupo: string
  nome: string
  frequencia: string
  resumo: string
  descricao: string
  cor: string
  icone: React.ReactNode
}

const AUTOMACOES: AutomacaoDef[] = [
  {
    id: "aniversario",
    grupo: "Clientes",
    nome: "Parabéns Automático",
    frequencia: "Diário às 09h",
    resumo: "Envia mensagem de aniversário com cupom de 15% de desconto",
    descricao: "Todo dia às 09h o sistema verifica quais clientes fazem aniversário naquele dia e envia automaticamente uma mensagem de parabéns pelo WhatsApp com um cupom de 15% de desconto. O sistema registra o ano em que a mensagem foi enviada para não repetir.",
    cor: "#f59e0b",
    icone: <Cake size={18} />,
  },
  {
    id: "consentimento",
    grupo: "Clientes",
    nome: "Pedido de Consentimento LGPD",
    frequencia: "Ao cadastrar cliente",
    resumo: "Envia pedido de autorização de WhatsApp para clientes novos",
    descricao: "Quando um cliente é cadastrado sem autorização de WhatsApp, o sistema envia automaticamente uma mensagem pedindo consentimento para receber novidades e avisos. O cliente responde com 'sim' ou 'não' e o sistema registra a resposta. Respostas como 'quero', 'pode mandar', 'aceito' também são reconhecidas.",
    cor: "#3b82f6",
    icone: <Bell size={18} />,
  },
  {
    id: "consentimento-correcao",
    grupo: "Clientes",
    nome: "Correção de Consentimento",
    frequencia: "Diário às 03h",
    resumo: "Corrige clientes que ficaram com consentimento pendente por engano",
    descricao: "Todo dia às 03h o sistema verifica se há clientes que responderam ao pedido de consentimento mas o registro não foi atualizado corretamente. Caso encontre, corrige automaticamente o status sem precisar de ação manual.",
    cor: "#6366f1",
    icone: <ShieldCheck size={18} />,
  },
  {
    id: "alertas",
    grupo: "Financeiro",
    nome: "Alertas Financeiros",
    frequencia: "Diário (horário configurável)",
    resumo: "Avisa sobre contas a vencer nos próximos dias",
    descricao: "O sistema verifica diariamente as contas a pagar com vencimento próximo e envia um aviso pelo WhatsApp para os números configurados em Configurações > Alertas. Você pode configurar até 2 números para receber os alertas.",
    cor: "#ef4444",
    icone: <AlertCircle size={18} />,
  },
  {
    id: "etiquetas-sync",
    grupo: "Etiquetas",
    nome: "Rastreamento de Envios",
    frequencia: "A cada 6 horas",
    resumo: "Atualiza o status de rastreamento das etiquetas automaticamente",
    descricao: "A cada 6 horas o sistema consulta a Melhor Envio e o Super Frete para atualizar o status de todas as etiquetas em trânsito. Quando um pacote é entregue, o status é atualizado automaticamente na tela de Etiquetas e a cliente recebe aviso pelo WhatsApp.",
    cor: "#f97316",
    icone: <Tag size={18} />,
  },
  {
    id: "google-alerta",
    grupo: "Integrações",
    nome: "Alerta de Desconexão Google",
    frequencia: "Verificação contínua",
    resumo: "Detecta quando o Google Contatos desconecta e avisa por WhatsApp",
    descricao: "Quando a sincronização com o Google Contacts falha por token expirado (acontece a cada ~7 dias), o sistema envia automaticamente um aviso por WhatsApp para reconectar a conta. Basta acessar Configurações > Google e clicar em Reconectar.",
    cor: "#4285f4",
    icone: <GoogleLogo size={18} />,
  },
  {
    id: "live-aviso",
    grupo: "Live",
    nome: "Disparo de Aviso de Live",
    frequencia: "Manual (acionado na Live)",
    resumo: "Envia aviso de live para compradoras históricas em ordem aleatória",
    descricao: "Ao clicar em Disparar na tela de Live, o sistema envia mensagens em lote para clientes que já compraram em lives anteriores, priorizando compradoras históricas. A lista é embaralhada a cada disparo e o sistema garante que o mesmo link não seja enviado duas vezes para a mesma pessoa.",
    cor: "#e11d48",
    icone: <Send size={18} />,
  },
  {
    id: "live-comprovante",
    grupo: "Live",
    nome: "Pedido de Comprovante de Pagamento",
    frequencia: "Automático ao registrar compra",
    resumo: "Pede comprovante de pagamento na mensagem de confirmação de compra",
    descricao: "Quando uma compra é registrada na Live e a mensagem de confirmação é enviada para a cliente, o sistema inclui automaticamente um pedido de envio do comprovante de pagamento. O prazo de pagamento pode ser definido manualmente em dias antes de enviar.",
    cor: "#e11d48",
    icone: <CheckCircle2 size={18} />,
  },
]

const GRUPOS = [...new Set(AUTOMACOES.map(a => a.grupo))]

function AbaAutomacoes() {
  const [expandido, setExpandido] = useState<string | null>(null)

  function toggle(id: string) {
    setExpandido(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(99,102,241,0.12)" }}>
          <Zap size={18} style={{ color: "#6366f1" }} />
        </div>
        <div>
          <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>Automações do Sistema</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {AUTOMACOES.length} automações configuradas · Clique em qualquer card para ver os detalhes
          </p>
        </div>
      </div>

      {/* Grupos */}
      {GRUPOS.map(grupo => (
        <div key={grupo}>
          {/* Título do grupo */}
          <p className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2"
            style={{ color: "var(--text-muted)" }}>
            <span className="h-px flex-1" style={{ background: "var(--border)" }} />
            {grupo}
            <span className="h-px flex-1" style={{ background: "var(--border)" }} />
          </p>

          <div className="space-y-2">
            {AUTOMACOES.filter(a => a.grupo === grupo).map((auto, i) => {
              const aberto = expandido === auto.id
              return (
                <motion.div
                  key={auto.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  {/* Linha principal — clicável */}
                  <button
                    onClick={() => toggle(auto.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
                    style={{ background: aberto ? `${auto.cor}06` : "transparent" }}
                  >
                    {/* Barra lateral colorida */}
                    <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
                      style={{ background: auto.cor }} />

                    {/* Ícone */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${auto.cor}18`, color: auto.cor }}>
                      {auto.icone}
                    </div>

                    {/* Texto */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{auto.nome}</p>
                        {/* Badge ativa */}
                        <span className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>
                          <motion.span
                            className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ background: "#4ade80" }}
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          Ativa
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                          {auto.frequencia}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{auto.resumo}</p>
                    </div>

                    {/* Chevron */}
                    <motion.div
                      animate={{ rotate: aberto ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <ChevronDown size={15} />
                    </motion.div>
                  </button>

                  {/* Detalhe expandido */}
                  <AnimatePresence>
                    {aberto && (
                      <motion.div
                        key="detail"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="px-5 pb-5 pt-1" style={{ borderTop: `1px solid ${auto.cor}20` }}>
                          <div className="rounded-xl p-4" style={{ background: `${auto.cor}08`, border: `1px solid ${auto.cor}20` }}>
                            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                              {auto.descricao}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
