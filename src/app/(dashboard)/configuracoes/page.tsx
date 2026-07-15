"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { AnimatePresence, motion } from "motion/react"
import {
  Loader2, Save, Building2, Users, X, Eye, EyeOff,
  Check, ShieldCheck, UserPlus, Pencil, Power,
  Plug, RefreshCw, Wifi, WifiOff, Database, Truck,
  MessageCircle, Globe, MapPin, AlertCircle, Mail, Bot, DollarSign,
  Play, CheckCircle2, XCircle, Clock, Send, Trash2,
} from "lucide-react"
import { apiGet, apiPost, apiPatch } from "@/services/api"
import { cn } from "@/lib/utils"
import { useDisparoStore } from "@/stores/disparo.store"

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

type Tab = "empresa" | "usuarios" | "integracoes" | "alertas" | "google"

interface IntegracaoStatus {
  id: string; nome: string; descricao: string
  conectado: boolean; configurado: boolean
  detalhe?: string; latencia?: number
}

const DEFAULTS: EmpresaConfig = {
  razao_social:      "SUELI VAZ MAESTRE DOS SANTOS",
  nome_fantasia:     "BRECHÓ BELLASU",
  cnpj:              "30.131.755/0001-96",
  ie:                "ISENTO",
  telefone:          "(16) 99134-7476",
  email:             "bellasu.brecho@gmail.com",
  logradouro:        "R. BARÃO DO AMAZONAS",
  numero:            "1035",
  bairro:            "CENTRO",
  cidade:            "RIBEIRÃO PRETO",
  estado:            "SP",
  cep:               "14080-270",
  regime_tributario: "MEI",
}

const PERFIS = ["admin", "operador", "caixa", "estoque"]
const REGIME_OPTIONS = ["MEI", "Simples Nacional", "Lucro Presumido", "Lucro Real"]

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
  asaas:       <DollarSign size={20} />,
  openai:      <Bot size={20} />,
  vercel:      <Globe size={20} />,
  viacep:      <MapPin size={20} />,
}

const COR_INTEGRACAO: Record<string, string> = {
  supabase:    "#3ecf8e",
  melhorenvio: "#00b4d8",
  zapi:        "#25d366",
  asaas:       "#f59e0b",
  openai:      "#10a37f",
  vercel:      "#ffffff",
  viacep:      "#a78bfa",
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

      {/* Limpeza de cobranças Asaas */}
      <AsaasLimpeza />
    </div>
  )
}

// ── Limpeza de cobranças Asaas da Live ───────────────────────
type LimpezaFase = "idle" | "verificando" | "preview" | "excluindo" | "resultado"
type LimpezaPreview = { quantidade: number; valor_total: number; preview: { id: string; valor: number; vencimento: string; status: string }[] }
type LimpezaResultado = { excluidas: number; erros: number }

function AsaasLimpeza() {
  const [fase, setFase] = useState<LimpezaFase>("idle")
  const [preview, setPreview] = useState<LimpezaPreview | null>(null)
  const [resultado, setResultado] = useState<LimpezaResultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function verificar() {
    setFase("verificando"); setErro(null); setPreview(null)
    try {
      const res = await apiGet<LimpezaPreview>("/admin/asaas/limpar-vencidas")
      setPreview(res)
      setFase("preview")
    } catch (e: unknown) {
      setErro((e as Error).message || "Erro ao verificar")
      setFase("idle")
    }
  }

  async function excluir() {
    setFase("excluindo"); setErro(null)
    try {
      const res = await apiPost<LimpezaResultado>("/admin/asaas/limpar-vencidas", { confirmar: true })
      setResultado(res)
      setFase("resultado")
    } catch (e: unknown) {
      setErro((e as Error).message || "Erro ao excluir")
      setFase("preview")
    }
  }

  function resetar() { setFase("idle"); setPreview(null); setResultado(null); setErro(null) }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="rounded-2xl p-5 mt-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
          <Trash2 size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Limpar cobranças Asaas da Live</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Remove cobranças <strong>pendentes</strong> e <strong>vencidas</strong> geradas pelo módulo Live (links enviados via WhatsApp).
          </p>

          {erro && (
            <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>
              {erro}
            </p>
          )}

          {/* Estado: idle */}
          {fase === "idle" && (
            <button onClick={verificar}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white"
              style={{ background: "#f59e0b" }}>
              <Trash2 size={13} /> Verificar cobranças
            </button>
          )}

          {/* Estado: verificando */}
          {fase === "verificando" && (
            <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <Loader2 size={13} className="animate-spin" /> Consultando Asaas…
            </div>
          )}

          {/* Estado: preview */}
          {fase === "preview" && preview && (
            <div className="mt-3 space-y-3">
              {preview.quantidade === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80" }}>
                  <CheckCircle2 size={13} /> Nenhuma cobrança pendente/vencida encontrada.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 px-4 py-3 rounded-xl"
                    style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <div className="text-center">
                      <p className="text-xl font-bold" style={{ color: "#f59e0b" }}>{preview.quantidade}</p>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>cobranças</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold" style={{ color: "#f59e0b" }}>
                        {preview.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>valor total</p>
                    </div>
                  </div>

                  {preview.preview.length > 0 && (
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                      {preview.preview.map((c, i) => (
                        <div key={c.id} className="flex items-center justify-between px-3 py-2 text-xs"
                          style={{ borderBottom: i < preview.preview.length - 1 ? "1px solid var(--border)" : "none", background: "var(--bg-base)" }}>
                          <span className="font-mono truncate" style={{ color: "var(--text-muted)" }}>{c.id}</span>
                          <span style={{ color: "var(--text-secondary)" }}>{c.vencimento}</span>
                          <span className="font-semibold" style={{ color: "#f59e0b" }}>
                            {c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: c.status === "OVERDUE" ? "rgba(248,113,113,0.12)" : "rgba(251,191,36,0.12)", color: c.status === "OVERDUE" ? "#f87171" : "#fbbf24" }}>
                            {c.status === "OVERDUE" ? "Vencida" : "Pendente"}
                          </span>
                        </div>
                      ))}
                      {preview.quantidade > 10 && (
                        <p className="text-[10px] text-center py-2" style={{ color: "var(--text-muted)" }}>
                          + {preview.quantidade - 10} mais…
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] px-3 py-2 rounded-xl"
                    style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", color: "#f87171" }}>
                    ⚠️ Esta ação é irreversível. As cobranças serão excluídas permanentemente do Asaas.
                  </p>

                  <div className="flex gap-2">
                    <button onClick={resetar}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold"
                      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      Cancelar
                    </button>
                    <button onClick={excluir}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-white"
                      style={{ background: "#ef4444" }}>
                      <Trash2 size={12} className="inline mr-1.5" />
                      Excluir {preview.quantidade} cobranças
                    </button>
                  </div>
                </>
              )}

              {preview.quantidade === 0 && (
                <button onClick={resetar} className="text-xs" style={{ color: "var(--text-muted)" }}>Fechar</button>
              )}
            </div>
          )}

          {/* Estado: excluindo */}
          {fase === "excluindo" && (
            <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <Loader2 size={13} className="animate-spin" /> Excluindo cobranças no Asaas…
            </div>
          )}

          {/* Estado: resultado */}
          {fase === "resultado" && resultado && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80" }}>
                <CheckCircle2 size={13} />
                {resultado.excluidas} cobrança{resultado.excluidas !== 1 ? "s" : ""} excluída{resultado.excluidas !== 1 ? "s" : ""} com sucesso!
                {resultado.erros > 0 && <span style={{ color: "#f87171" }}> · {resultado.erros} erro{resultado.erros !== 1 ? "s" : ""}</span>}
              </div>
              <button onClick={resetar} className="text-xs" style={{ color: "var(--text-muted)" }}>Fechar</button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Logo Google (SVG inline) ──────────────────────────────────
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

const ACAO_COR: Record<string, string> = {
  criar:     "text-emerald-400",
  atualizar: "text-blue-400",
  ignorar:   "text-slate-500",
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
    { key: "alertas",      label: "Alertas",      icon: <AlertCircle size={14} /> },
    { key: "google",       label: "Google",       icon: <GoogleLogo size={14} /> },
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

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
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

        {tab === "google" && (
          <motion.div key="google" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AbaGoogle />
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
  const [zapiStatus, setZapiStatus] = useState<{ conectado: boolean; detalhe: string } | null>(null)
  const [testando, setTestando] = useState(false)

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

  async function testarZapi() {
    setTestando(true); setZapiStatus(null)
    try {
      const res = await apiPost("/configuracoes/zapi", {}) as { conectado: boolean; detalhe: string }
      setZapiStatus(res)
    } catch { setZapiStatus({ conectado: false, detalhe: "Erro de conexão" }) }
    finally { setTestando(false) }
  }

  const iBase = "w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all border focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }

  return (
    <div className="space-y-6">
      {/* Z-API Status */}
      <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle size={16} style={{ color: "var(--accent)" }} />
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>WhatsApp (Z-API)</h3>
        </div>
        <button onClick={testarZapi} disabled={testando}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ background: "rgba(37,211,102,0.1)", color: "#25d366", border: "1px solid rgba(37,211,102,0.25)" }}>
          {testando ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
          Testar conexão
        </button>
        {zapiStatus && (
          <p className={cn("text-xs mt-3 px-3 py-2 rounded-lg",
            zapiStatus.conectado ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
            {zapiStatus.conectado ? "✅" : "❌"} {zapiStatus.detalhe}
          </p>
        )}
      </div>

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
