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
} from "lucide-react"
import { apiGet, apiPost, apiPatch } from "@/services/api"
import { cn } from "@/lib/utils"

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

type Tab = "empresa" | "usuarios" | "integracoes"

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
      const msg = (e as { response?: { data?: { erro?: string } } })?.response?.data?.erro
      setErro(msg ?? "Erro ao salvar")
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

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {/* Cabeçalho */}
        <div className="grid grid-cols-12 gap-3 px-5 py-3"
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
              className="grid grid-cols-12 gap-3 items-center px-5 py-3.5 transition-colors"
              style={{ borderBottom: i < usuarios.length - 1 ? "1px solid var(--border)" : "none" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent" }}>
              <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                  {u.nome[0].toUpperCase()}
                </div>
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{u.nome}</p>
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
              <div className="grid grid-cols-2 gap-4">

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
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass} style={{ color: "var(--text-muted)" }}>CEP</label>
                        <input {...register("cep")} className={iBase} style={iSt} placeholder="00000-000" />
                      </div>
                      <div className="col-span-2">
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
      </AnimatePresence>
    </div>
  )
}
