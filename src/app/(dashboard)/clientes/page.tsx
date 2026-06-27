"use client"

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "motion/react"
import {
  Plus, Search, UserX, UserCheck, Pencil, Loader2,
  X, ChevronLeft, ChevronRight, ArrowRight, Check, MapPin, AlertCircle, CalendarDays,
  Phone, AtSign, FileText, Home, Power, ShoppingBag, Bell, BellOff,
  Package, RefreshCw, Truck, ChevronDown, Eye, Send, CheckCircle2, XCircle, Clock,
  Tag, Printer, Copy, Wallet, TrendingUp, TrendingDown, MessageCircle, Trash2,
} from "lucide-react"
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/services/api"
import { useDebounce } from "@/hooks/useDebounce"
import { SuccessOverlay } from "@/components/SuccessOverlay"
import { EtiquetaPDFModal } from "@/components/EtiquetaPDFModal"
import DatePicker from "@/components/DatePicker"
import { fmtData, cn } from "@/lib/utils"
import { CpfCnpj } from "@/domain/shared/cpf-cnpj"
import type { Cliente } from "@/types"
import { useTableKeyNav } from "@/hooks/useKeyNav"

// ─── Tipos ────────────────────────────────────────────────
interface ClienteForm {
  nome: string
  apelido: string
  cpf_cnpj: string
  data_nasc: string
  celular: string
  instagram: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  // Endereço de entrega alternativo (opcional)
  entrega_cep: string
  entrega_logradouro: string
  entrega_numero: string
  entrega_complemento: string
  entrega_bairro: string
  entrega_cidade: string
  entrega_estado: string
}

const EMPTY: ClienteForm = {
  nome: "", apelido: "", cpf_cnpj: "", data_nasc: "", celular: "", instagram: "",
  cep: "", logradouro: "", numero: "",
  complemento: "", bairro: "", cidade: "", estado: "",
  entrega_cep: "", entrega_logradouro: "", entrega_numero: "",
  entrega_complemento: "", entrega_bairro: "", entrega_cidade: "", entrega_estado: "",
}

// ─── Animação de slide ────────────────────────────────────
const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
}

type CepStatus = "idle" | "buscando" | "encontrado" | "invalido" | "manual"

// ─── Motivos para crédito manual ─────────────────────────────────────────────
type MotivoCredito = { topico: string; emoji: string; cor: string; origem: string; motivos: string[] }
const MOTIVOS_CREDITO: MotivoCredito[] = [
  {
    topico: "Troca", emoji: "🔄", cor: "#6366f1", origem: "troca",
    motivos: [
      "Tamanho pequeno", "Tamanho grande", "Modelagem não serviu",
      "Peça ficou apertada", "Peça ficou larga", "Comprimento inadequado",
      "Caimento não agradou", "Cliente prefere outro modelo", "Cliente prefere outra cor",
      "Peça não combinou com a cliente", "Peça não atendeu à expectativa",
      "Produto com defeito", "Produto com avaria", "Produto com mancha",
      "Produto com rasgo", "Costura solta", "Zíper com problema",
      "Produto separado errado", "Produto entregue errado",
      "Peça não correspondeu à expectativa da live", "Cliente confundiu a peça durante a live",
    ],
  },
  {
    topico: "Devolução", emoji: "↩️", cor: "#f59e0b", origem: "devolucao",
    motivos: [
      "Cliente desistiu da compra", "Arrependimento da compra",
      "Cliente mudou de ideia", "Compra realizada por engano",
      "Produto com defeito", "Produto com avaria", "Produto diferente do anunciado",
      "Produto em condição diferente da informada", "Produto não atendeu à expectativa",
      "Produto errado entregue", "Pedido incompleto", "Extravio na entrega",
      "Atraso na entrega", "Pagamento duplicado", "Cobrança indevida",
      "Valor cobrado incorretamente", "Cliente solicitou estorno",
      "Cliente não retirou no prazo", "Produto retornou para a loja",
    ],
  },
  {
    topico: "Cortesia", emoji: "🎁", cor: "#10b981", origem: "manual",
    motivos: [
      "Cortesia pela fidelidade", "Acordo com cliente", "Compensação por atraso",
      "Compensação por falha no atendimento", "Presente da loja",
      "Programa de fidelidade", "Bônus especial", "Desconto combinado",
    ],
  },
  {
    topico: "Ajuste", emoji: "⚙️", cor: "#8b5cf6", origem: "ajuste",
    motivos: [
      "Correção de lançamento", "Ajuste interno de estoque",
      "Cancelamento administrativo", "Lançamento feito em duplicidade",
      "Venda registrada incorretamente", "Tratativa excepcional",
      "Autorizado pela gerência", "Motivo não informado pela cliente",
    ],
  },
]

const ESTADO_SIGLA: Record<string, string> = {
  "Acre":"AC","Alagoas":"AL","Amapá":"AP","Amazonas":"AM","Bahia":"BA","Ceará":"CE",
  "Distrito Federal":"DF","Espírito Santo":"ES","Goiás":"GO","Maranhão":"MA",
  "Mato Grosso":"MT","Mato Grosso do Sul":"MS","Minas Gerais":"MG","Pará":"PA",
  "Paraíba":"PB","Paraná":"PR","Pernambuco":"PE","Piauí":"PI","Rio de Janeiro":"RJ",
  "Rio Grande do Norte":"RN","Rio Grande do Sul":"RS","Rondônia":"RO","Roraima":"RR",
  "Santa Catarina":"SC","São Paulo":"SP","Sergipe":"SE","Tocantins":"TO",
}

interface EndSugestao {
  label: string
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  estado: string
  _score?: number
  _numero?: string
  _isRP?: boolean
}

// ── Normalização de texto para busca ─────────────────────────
function normAddr(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
}

// Expande abreviações comuns de logradouro
function expandAbrev(s: string): string {
  return s
    .replace(/\bR\.\s*/gi, "Rua ")
    .replace(/\bAv\.\s*/gi, "Avenida ")
    .replace(/\bTrav\.\s*/gi, "Travessa ")
    .replace(/\bTv\.\s*/gi, "Travessa ")
    .replace(/\bAl\.\s*/gi, "Alameda ")
    .replace(/\bPr?\.\s*/gi, "Praça ")
    .replace(/\bEstr\.\s*/gi, "Estrada ")
    .replace(/\bRod\.\s*/gi, "Rodovia ")
    .replace(/\bCon[dj]\.\s*/gi, "Condomínio ")
    .replace(/\bDr\.\s*/gi, "Doutor ")
    .replace(/\bDra\.\s*/gi, "Doutora ")
    .replace(/\bProf\.\s*/gi, "Professor ")
    .replace(/\bProfa\.\s*/gi, "Professora ")
    .replace(/\bEng\.\s*/gi, "Engenheiro ")
    .replace(/\bDep\.\s*/gi, "Deputado ")
    .replace(/\bVer\.\s*/gi, "Vereador ")
    .replace(/\bCel\.\s*/gi, "Coronel ")
    .replace(/\bCap\.\s*/gi, "Capitão ")
    .replace(/\s+/g, " ").trim()
}

// ─── Confete ──────────────────────────────────────────────
const CONFETE_CORES = ["#a78bfa","#6366f1","#34d399","#f472b6","#fbbf24","#60a5fa","#f0abfc","#4ade80"]

function Confete({ show }: { show: boolean }) {
  const pieces = useMemo(() => Array.from({ length: 48 }, (_, i) => {
    const angle  = (i / 48) * 360
    const dist   = 120 + Math.random() * 180
    const rad    = (angle * Math.PI) / 180
    const tx     = Math.cos(rad) * dist
    const ty     = Math.sin(rad) * dist - 80
    const rotate = Math.random() * 720 - 360
    const cor    = CONFETE_CORES[i % CONFETE_CORES.length]
    const size   = 6 + Math.random() * 8
    const shape  = i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0%"
    const duration = 0.9 + Math.random() * 0.4
    return { tx, ty, rotate, cor, size, shape, delay: Math.random() * 0.15, duration }
  }), [])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
      {pieces.map((p, i) => (
        <motion.div key={i}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{ opacity: 0, x: p.tx, y: p.ty, rotate: p.rotate, scale: 0.3 }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.2, 0, 0.8, 1] }}
          style={{
            position: "absolute",
            width: p.size, height: p.size,
            background: p.cor,
            borderRadius: p.shape,
          }}
        />
      ))}
    </div>
  )
}

// ─── Drawer Resumo do Cliente ─────────────────────────────
// ─── Conteúdo com Tabs do Drawer ─────────────────────────
type DrawerTab = "dados" | "historico" | "creditos" | "etiquetas" | "notificacoes"

type CreditoMov = {
  id: number
  tipo: "entrada" | "saida"
  origem: string
  valor: number
  saldo_antes: number
  saldo_depois: number
  obs: string | null
  operacao_id: number | null
  operacao_tipo: string | null
  created_at: string
  usuarios: { nome: string } | null
}
type HistoricoData = {
  vendas: { id: number; data: string; total: number; forma_pagamento: string; status: string; itens: { nome: string; qtd: number; subtotal: number }[] }[]
  trocas: { id: number; tipo: string; status: string; motivo: string; created_at: string }[]
  envios: { id: number; created_at: string; rastreio: string; ultimo_status: string }[]
  total_gasto: number
  total_compras: number
}

// Informações visuais para cada estado de notificacao_status
function notificacaoStatusInfo(status?: string | null) {
  switch (status) {
    case "enviado":
      return {
        emoji: "📤", bgCard: "rgba(251,191,36,0.06)", border: "rgba(251,191,36,0.2)",
        badge: "bg-amber-500/15 text-amber-400",
        label: "ENVIADO", descricao: "Mensagem enviada. Aguardando resposta do cliente.",
      }
    case "autorizado":
      return {
        emoji: "✅", bgCard: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.2)",
        badge: "bg-emerald-500/15 text-emerald-400",
        label: "AUTORIZADO", descricao: "Cliente autorizou o recebimento de mensagens pelo WhatsApp.",
      }
    case "recusado":
      return {
        emoji: "❌", bgCard: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.2)",
        badge: "bg-red-500/15 text-red-400",
        label: "RECUSADO", descricao: "Cliente não autorizou o recebimento de mensagens.",
      }
    case "erro":
      return {
        emoji: "⚠️", bgCard: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.2)",
        badge: "bg-red-500/15 text-red-400",
        label: "ERRO", descricao: "Falha no envio ou no processamento da mensagem.",
      }
    default:
      return {
        emoji: "📭", bgCard: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.15)",
        badge: "bg-slate-500/15 text-slate-400",
        label: "NÃO ENVIADO", descricao: "A mensagem de consentimento ainda não foi enviada.",
      }
  }
}

function DrawerContent({ cliente, info, onEditarCampo }: { cliente: Cliente; info: { icon: React.ReactNode; label: string; value: string; full?: boolean; href?: string; step?: number }[]; onEditarCampo?: (step: number) => void }) {
  const [tab, setTab] = useState<DrawerTab>("dados")
  const qc = useQueryClient()

  const { data: historico, isLoading: loadHist } = useQuery<HistoricoData>({
    queryKey: ["cliente-historico", cliente.id],
    queryFn: () => apiGet(`/clientes/${cliente.id}/historico`),
    enabled: tab === "historico",
    staleTime: 60_000,
  })

  // ── Créditos ──────────────────────────────────────────────
  const { data: creditosData, isLoading: loadCreditos, refetch: refetchCreditos } = useQuery<{
    data: CreditoMov[]; total: number; saldo: number
  }>({
    queryKey: ["cliente-creditos", cliente.id],
    queryFn: () => apiGet(`/clientes/${cliente.id}/creditos`),
    enabled: tab === "creditos",
    staleTime: 30_000,
  })

  const [creditoForm, setCreditoForm] = useState(false)
  const [excluindoMovId, setExcluindoMovId] = useState<number | null>(null)
  async function excluirMovimentacao(movId: number) {
    setExcluindoMovId(movId)
    try {
      await apiDelete(`/clientes/${cliente.id}/creditos/${movId}`)
      refetchCreditos()
    } catch { /* silencia */ }
    finally { setExcluindoMovId(null) }
  }
  const [creditoValor, setCreditoValor] = useState("")
  const [creditoOrigem, setCreditoOrigem] = useState("manual")
  const [creditoObs, setCreditoObs] = useState("")
  const [creditoMotivo, setCreditoMotivo] = useState("")
  const [creditoMotivoFase, setCreditoMotivoFase] = useState<"topicos" | "motivos">("topicos")
  const [creditoMotivoTopico, setCreditoMotivoTopico] = useState<typeof MOTIVOS_CREDITO[0] | null>(null)
  const [creditoLoading, setCreditoLoading] = useState(false)
  const [creditoErro, setCreditoErro] = useState("")

  function maskCurrency(raw: string): string {
    const digits = raw.replace(/\D/g, "")
    if (!digits) return ""
    const num = parseInt(digits, 10) / 100
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }

  async function adicionarCredito() {
    const v = parseFloat(creditoValor.replace(/[R$\s.]/g, "").replace(",", "."))
    if (!v || v <= 0) { setCreditoErro("Informe um valor válido."); return }
    if (!creditoMotivo) { setCreditoErro("Selecione um motivo."); return }
    const origem = creditoMotivoTopico?.origem ?? creditoOrigem
    const obs = creditoMotivo + (creditoObs ? ` — ${creditoObs}` : "")
    setCreditoLoading(true); setCreditoErro("")
    try {
      await apiPost(`/clientes/${cliente.id}/creditos`, {
        valor: v, origem, obs,
      })
      setCreditoForm(false); setCreditoValor(""); setCreditoObs("")
      setCreditoMotivo(""); setCreditoMotivoFase("topicos"); setCreditoMotivoTopico(null)
      qc.invalidateQueries({ queryKey: ["clientes"] })
      refetchCreditos()
    } catch (e) {
      setCreditoErro((e as Error).message || "Erro ao adicionar crédito.")
    } finally { setCreditoLoading(false) }
  }

  // ── Google Sync ───────────────────────────────────────────
  const [googleSyncing, setGoogleSyncing] = useState(false)
  const [googleSyncMsg, setGoogleSyncMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null)

  async function sincronizarGoogle() {
    setGoogleSyncing(true); setGoogleSyncMsg(null)
    try {
      const res = await apiPost(`/clientes/${cliente.id}/google-sync`, {})
      const r = res as { ok: boolean; acao?: string; erro?: string }
      if (r.ok) {
        setGoogleSyncMsg({ tipo: "ok", texto: r.acao === "criar" ? "Contato criado no Google!" : "Contato atualizado no Google!" })
        qc.invalidateQueries({ queryKey: ["clientes"] })
      } else {
        setGoogleSyncMsg({ tipo: "erro", texto: r.erro ?? "Falha na sincronização." })
      }
    } catch (e) {
      setGoogleSyncMsg({ tipo: "erro", texto: (e as Error).message || "Erro ao sincronizar." })
    } finally { setGoogleSyncing(false) }
  }

  const [toggling, setToggling] = useState(false)
  const [consentErro, setConsentErro] = useState("")
  const [consentOk, setConsentOk] = useState("")

  // Polling automático enquanto aguardando resposta (status "enviado")
  useEffect(() => {
    if (tab !== "notificacoes" || cliente.notificacao_status !== "enviado") return
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["clientes"] })
    }, 15_000)
    return () => clearInterval(interval)
  }, [tab, cliente.notificacao_status, qc])

  async function revogarConsentimento() {
    setToggling(true); setConsentErro(""); setConsentOk("")
    try {
      await apiPatch(`/clientes/${cliente.id}/consentimento`, { acao: "revogar" })
      qc.invalidateQueries({ queryKey: ["clientes"] })
      setConsentOk("Consentimento revogado com sucesso.")
    } catch (e) {
      setConsentErro((e as Error).message || "Erro ao revogar consentimento.")
    } finally { setToggling(false) }
  }

  const TABS: { key: DrawerTab; label: string; icon: React.ReactNode }[] = [
    { key: "dados",        label: "Dados",        icon: <FileText size={13} /> },
    { key: "historico",    label: "Histórico",    icon: <ShoppingBag size={13} /> },
    { key: "creditos",     label: "Créditos",     icon: <Wallet size={13} /> },
    { key: "etiquetas",    label: "Etiquetas",    icon: <Tag size={13} /> },
    { key: "notificacoes", label: "Notificações", icon: <Bell size={13} /> },
  ]

  return (
    <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
      {/* Tab bar */}
      <div className="flex gap-1 px-4 sm:px-6 pt-4 pb-2 shrink-0 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t, i) => (
          <motion.button
            key={t.key}
            onClick={() => setTab(t.key)}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            className="relative shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
            style={{
              background: tab === t.key ? "var(--accent)" : "transparent",
              color: tab === t.key ? "#fff" : "var(--text-muted)",
            }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}>
            {t.icon} {t.label}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18 }}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 pt-5 pb-6 space-y-3 drawer-scroll"
      >
        {/* Aba Dados — Card Google Sync */}
        {tab === "dados" && (() => {
          const gs = cliente.google_sync_status
          const syncColor = gs === "sincronizado" ? "#10b981" : gs === "erro" ? "#f87171" : gs === "sincronizando" ? "#60a5fa" : "#94a3b8"
          const syncLabel = gs === "sincronizado" ? "Sincronizado" : gs === "erro" ? "Erro" : gs === "sincronizando" ? "Sincronizando…" : "Pendente"
          const syncBg   = gs === "sincronizado" ? "rgba(16,185,129,0.08)" : gs === "erro" ? "rgba(248,113,113,0.08)" : gs === "sincronizando" ? "rgba(96,165,250,0.08)" : "rgba(148,163,184,0.06)"
          const syncBorder = gs === "sincronizado" ? "rgba(16,185,129,0.25)" : gs === "erro" ? "rgba(248,113,113,0.25)" : gs === "sincronizando" ? "rgba(96,165,250,0.25)" : "rgba(148,163,184,0.15)"
          const nomeMontado = [
            cliente.nome?.trim().toUpperCase(),
            cliente.instagram ? `@${cliente.instagram.replace(/^@/, "").toUpperCase()}` : null,
          ].filter(Boolean).join(" - ")
          return (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl px-4 py-3 flex items-center gap-3 mb-1"
              style={{ background: syncBg, border: `1px solid ${syncBorder}` }}>
              <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: `${syncColor}18` }}>
                {gs === "sincronizando"
                  ? <Loader2 size={15} className="animate-spin" style={{ color: syncColor }} />
                  : <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Google Contatos</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ background: `${syncColor}18`, color: syncColor }}>{syncLabel}</span>
                </div>
                <p className="text-xs truncate mt-0.5 font-medium" style={{ color: "var(--text-secondary)" }}>{nomeMontado || "—"}</p>
                {gs === "sincronizado" && cliente.google_sync_at && (
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {new Date(cliente.google_sync_at).toLocaleDateString("pt-BR")}
                  </p>
                )}
                {gs === "erro" && cliente.google_sync_erro && (
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: "#f87171" }}>{cliente.google_sync_erro}</p>
                )}
              </div>
              <button onClick={sincronizarGoogle} disabled={googleSyncing}
                title="Sincronizar agora"
                className="shrink-0 p-2 rounded-lg transition-colors disabled:opacity-40"
                style={{ background: `${syncColor}18`, color: syncColor }}>
                <RefreshCw size={13} className={googleSyncing ? "animate-spin" : ""} />
              </button>
            </motion.div>
          )
        })()}
        {googleSyncMsg && tab === "dados" && (
          <p className={`text-xs text-center py-1.5 px-3 rounded-lg mb-1 ${googleSyncMsg.tipo === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
            {googleSyncMsg.texto}
          </p>
        )}

        {/* Aba Dados */}
        {tab === "dados" && info.map(({ icon, label, value, href, step }, i) => (
          <motion.div key={label}
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 + i * 0.03 }}
            className="group/card relative">
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors group"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#25d366" }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)" }}>
                <div className="shrink-0" style={{ color: "#25d366" }}>{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className="text-sm font-medium uppercase leading-snug" style={{ color: "var(--text-primary)" }}>{value}</p>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: "#25d366" }}>Abrir ›</span>
                {step && onEditarCampo && (
                  <motion.button
                    whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                    onClick={e => { e.preventDefault(); onEditarCampo(step) }}
                    title={`Editar ${label}`}
                    className="shrink-0 transition-all p-1.5 rounded-lg"
                    style={{ color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--accent-bg)" }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "var(--bg-surface)" }}>
                    <Pencil size={13} />
                  </motion.button>
                )}
              </a>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl transition-all"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <div className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }}>{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className="text-sm font-medium uppercase leading-snug" style={{ color: "var(--text-primary)" }}>{value}</p>
                </div>
                {step && onEditarCampo && (
                  <motion.button
                    whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                    onClick={() => onEditarCampo(step)}
                    title={`Editar ${label}`}
                    className="shrink-0 transition-all p-1.5 rounded-lg ml-1"
                    style={{ color: "var(--text-muted)", background: "transparent" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--accent-bg)" }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent" }}>
                    <Pencil size={13} />
                  </motion.button>
                )}
              </div>
            )}
          </motion.div>
        ))}

        {/* Aba Histórico */}
        {tab === "historico" && (
          loadHist ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} /></div>
          ) : (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>Total gasto</p>
                  <p className="text-lg font-bold" style={{ color: "#10b981" }}>R$ {(historico?.total_gasto ?? 0).toFixed(2).replace(".", ",")}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>Compras</p>
                  <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{historico?.total_compras ?? 0}</p>
                </div>
              </div>

              {/* Vendas */}
              <p className="text-[10px] font-bold uppercase tracking-wider pt-2" style={{ color: "var(--text-muted)" }}>Compras</p>
              {(historico?.vendas ?? []).length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>Nenhuma compra registrada.</p>
              ) : (historico?.vendas ?? []).map(v => (
                <div key={v.id} className="rounded-xl px-4 py-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>Venda #{v.id}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{new Date(v.data).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <div className="space-y-0.5">
                    {v.itens.map((it, i) => (
                      <p key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {it.qtd}x {it.nome} — R$ {Number(it.subtotal).toFixed(2).replace(".", ",")}
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{v.forma_pagamento}</span>
                    <span className="text-sm font-bold" style={{ color: "#10b981" }}>R$ {Number(v.total).toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              ))}

              {/* Envios */}
              {(historico?.envios ?? []).length > 0 && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wider pt-2" style={{ color: "var(--text-muted)" }}>Envios</p>
                  {historico!.envios.map(e => (
                    <div key={e.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                      <div>
                        <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{e.rastreio}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{new Date(e.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                        e.ultimo_status === "entregue" ? "bg-emerald-500/15 text-emerald-400" :
                        e.ultimo_status === "em_transito" ? "bg-blue-500/15 text-blue-400" :
                        "bg-amber-500/15 text-amber-400"
                      )}>{e.ultimo_status?.replace("_", " ") ?? "gerada"}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )
        )}

        {/* Aba Notificações */}
        {tab === "notificacoes" && (() => {
          const st = notificacaoStatusInfo(cliente.notificacao_status)
          const podeRevogar = cliente.notificacao_status === "autorizado"
          const aguardando = cliente.notificacao_status === "enviado"
          return (
            <>
              <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                Consentimento LGPD para disparos de WhatsApp. Use o botão <strong style={{ color: "var(--text-primary)" }}>Notificar</strong> no topo para enviar a mensagem.
              </p>

              {/* Card de status principal */}
              <div className="rounded-2xl px-5 py-5 flex flex-col items-center gap-3 text-center"
                style={{ background: st.bgCard, border: `1px solid ${st.border}` }}>

                {/* Emoji grande */}
                <div className="text-4xl leading-none">{st.emoji}</div>

                {/* Badge de status */}
                <span className={cn("text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-widest", st.badge)}>
                  {st.label}
                </span>

                {/* Descrição */}
                <p className="text-xs leading-relaxed max-w-[220px]" style={{ color: "var(--text-muted)" }}>
                  {st.descricao}
                </p>

                {/* Indicador de polling quando aguardando */}
                {aguardando && (
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <Loader2 size={11} className="animate-spin" />
                    Verificando resposta automaticamente...
                  </div>
                )}
              </div>

              {/* Botão revogar — só aparece quando autorizado */}
              {podeRevogar && (
                <button
                  onClick={revogarConsentimento}
                  disabled={toggling}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 mt-1"
                  style={{
                    background: "rgba(248,113,113,0.08)",
                    color: "#f87171",
                    border: "1px solid rgba(248,113,113,0.25)",
                  }}>
                  {toggling ? "Revogando..." : "Revogar autorização"}
                </button>
              )}

              {/* Feedback */}
              {consentOk && (
                <p className="text-xs text-center py-1.5 px-3 rounded-lg bg-emerald-500/10 text-emerald-400">{consentOk}</p>
              )}
              {consentErro && (
                <p className="text-xs text-center py-1.5 px-3 rounded-lg bg-red-500/10 text-red-400">{consentErro}</p>
              )}

              {!cliente.celular && (
                <p className="text-xs text-center py-2 px-3 rounded-lg bg-amber-500/10 text-amber-400">
                  ⚠️ Cadastre o celular do cliente antes de enviar notificação.
                </p>
              )}
            </>
          )
        })()}

        {/* Aba Créditos */}
        {tab === "creditos" && (
          <div className="space-y-2 pb-4">
            {/* Card de saldo — compacto quando form aberto */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl flex items-center justify-between"
              style={{
                padding: creditoForm ? "10px 16px" : "16px 20px",
                background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.04))",
                border: "1px solid rgba(251,191,36,0.3)",
                transition: "padding 0.2s",
              }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "rgba(251,191,36,0.7)" }}>Saldo disponível</p>
                <p className={creditoForm ? "text-xl font-bold" : "text-3xl font-bold"} style={{ color: "#fbbf24", transition: "font-size 0.2s" }}>
                  R$ {(creditosData?.saldo ?? (cliente as Cliente & { saldo_credito?: number }).saldo_credito ?? 0).toFixed(2).replace(".", ",")}
                </p>
              </div>
              <Wallet size={creditoForm ? 20 : 32} style={{ color: "rgba(251,191,36,0.4)", transition: "all 0.2s" }} />
            </motion.div>

            {/* Botão + Adicionar crédito */}
            <button onClick={() => { setCreditoForm(true); setCreditoErro(""); setCreditoMotivoFase("topicos"); setCreditoMotivoTopico(null); setCreditoMotivo(""); setCreditoValor("") }}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
              style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(251,191,36,0.18)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(251,191,36,0.10)" }}>
              <Plus size={15} /> ADICIONAR CRÉDITO
            </button>

            {/* ── Wizard fullscreen de crédito ── */}
            <AnimatePresence>
              {creditoForm && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                  transition={{ type: "spring", stiffness: 340, damping: 30 }}
                  className="fixed inset-0 z-[80] flex flex-col"
                  style={{ background: "var(--bg-base)" }}>

                  {/* Top bar */}
                  <div className="shrink-0 flex items-center justify-between px-5 sm:px-8 py-4"
                    style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)" }}>
                        <Wallet size={18} style={{ color: "#fbbf24" }} />
                      </div>
                      <div>
                        <p className="font-black text-sm uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
                          ADICIONAR CRÉDITO
                        </p>
                        <p className="text-[11px] mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                          {cliente.nome}
                        </p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => { setCreditoForm(false); setCreditoErro("") }}
                      className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                      <X size={15} /> FECHAR
                    </motion.button>
                  </div>

                  {/* Wizard — tela única: categoria → motivos expandem abaixo → valor */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto">
                      <div className="max-w-lg mx-auto px-5 sm:px-8 py-6 space-y-5">

                        {/* ── BLOCO 1: Categorias ── */}
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                            1 — Categoria do crédito
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {MOTIVOS_CREDITO.map(t => {
                              const sel = creditoMotivoTopico?.topico === t.topico
                              return (
                                <motion.button key={t.topico}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => {
                                    setCreditoMotivoTopico(sel ? null : t)
                                    setCreditoMotivo("")
                                    setCreditoMotivoFase("motivos")
                                  }}
                                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                                  style={{
                                    background: sel ? `${t.cor}18` : `${t.cor}08`,
                                    border: `2px solid ${sel ? t.cor : `${t.cor}35`}`,
                                  }}>
                                  <span className="text-2xl leading-none shrink-0">{t.emoji}</span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-black uppercase tracking-wide truncate" style={{ color: t.cor }}>{t.topico}</p>
                                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t.motivos.length} motivos</p>
                                  </div>
                                  <motion.span
                                    animate={{ rotate: sel ? 90 : 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="ml-auto shrink-0"
                                    style={{ color: `${t.cor}80` }}>
                                    <ChevronRight size={14} />
                                  </motion.span>
                                </motion.button>
                              )
                            })}
                          </div>
                        </div>

                        {/* ── BLOCO 2: Motivos (expande abaixo da categoria selecionada) ── */}
                        <AnimatePresence>
                          {creditoMotivoTopico && (
                            <motion.div
                              key={creditoMotivoTopico.topico}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.22, ease: "easeInOut" }}
                              style={{ overflow: "hidden" }}>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                                  2 — Motivo específico{" "}
                                  <span className="ml-1 px-1.5 py-0.5 rounded text-[9px]"
                                    style={{ background: `${creditoMotivoTopico.cor}20`, color: creditoMotivoTopico.cor }}>
                                    {creditoMotivoTopico.emoji} {creditoMotivoTopico.topico}
                                  </span>
                                </p>
                                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                                  {creditoMotivoTopico.motivos.map((m, i) => {
                                    const mSel = creditoMotivo === m
                                    return (
                                      <motion.button key={m}
                                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.025, duration: 0.15 }}
                                        onClick={() => setCreditoMotivo(mSel ? "" : m)}
                                        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                                        style={{
                                          background: mSel ? `${creditoMotivoTopico.cor}12` : "var(--bg-card)",
                                          borderBottom: i < creditoMotivoTopico.motivos.length - 1 ? "1px solid var(--border)" : "none",
                                        }}>
                                        <span className="text-sm font-bold uppercase tracking-wide" style={{ color: mSel ? creditoMotivoTopico.cor : "var(--text-primary)" }}>{m}</span>
                                        <AnimatePresence mode="wait">
                                          {mSel
                                            ? <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                                <Check size={14} style={{ color: creditoMotivoTopico.cor }} />
                                              </motion.span>
                                            : <motion.span key="arrow" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                                <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                                              </motion.span>
                                          }
                                        </AnimatePresence>
                                      </motion.button>
                                    )
                                  })}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* ── BLOCO 3: Valor (aparece após selecionar motivo) ── */}
                        <AnimatePresence>
                          {creditoMotivo && (
                            <motion.div
                              key="valor"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.22, ease: "easeInOut" }}
                              style={{ overflow: "hidden" }}>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                                  3 — Valor do crédito
                                </p>
                                <input
                                  type="text" inputMode="numeric"
                                  placeholder="R$ 0,00"
                                  value={creditoValor}
                                  autoFocus
                                  onChange={e => setCreditoValor(maskCurrency(e.target.value))}
                                  className="w-full px-5 py-5 rounded-2xl text-2xl font-black outline-none text-center transition-all"
                                  style={{
                                    background: "var(--bg-card)",
                                    border: "2px solid var(--border)",
                                    color: "#fbbf24",
                                    letterSpacing: "0.04em",
                                  }}
                                  onFocus={e => { e.currentTarget.style.borderColor = "#fbbf24"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(251,191,36,0.15)" }}
                                  onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
                                />
                                {creditoErro && (
                                  <p className="text-sm font-bold text-red-400 text-center mt-3 uppercase">{creditoErro}</p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                      </div>
                    </div>

                    {/* Rodapé fixo — botão confirmar */}
                    {true && (
                      <div className="shrink-0 px-5 sm:px-8 py-4" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card)" }}>
                        {creditoErro && (
                          <p className="text-sm font-bold text-red-400 text-center mb-3 uppercase">{creditoErro}</p>
                        )}
                        <motion.button
                          onClick={adicionarCredito}
                          disabled={!creditoValor || !creditoMotivo || creditoLoading}
                          whileHover={{ scale: creditoValor && creditoMotivo ? 1.01 : 1 }}
                          whileTap={{ scale: creditoValor && creditoMotivo ? 0.98 : 1 }}
                          className="w-full py-4 rounded-2xl text-base font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all disabled:opacity-40"
                          style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#1a0f00", boxShadow: creditoValor && creditoMotivo ? "0 6px 24px rgba(251,191,36,0.35)" : "none" }}>
                          {creditoLoading
                            ? <><Loader2 size={18} className="animate-spin" /> CONFIRMANDO...</>
                            : <><Wallet size={18} /> CONFIRMAR CRÉDITO</>}
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Histórico de movimentações — oculto quando formulário de crédito está aberto */}
            {!creditoForm && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider pt-1" style={{ color: "var(--text-muted)" }}>Movimentações</p>
                {loadCreditos ? (
                  <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} /></div>
                ) : (creditosData?.data ?? []).length === 0 ? (
                  <div className="py-10 text-center">
                    <Wallet size={28} className="mx-auto mb-2 opacity-30" style={{ color: "var(--text-muted)" }} />
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhuma movimentação de crédito ainda.</p>
                  </div>
                ) : (creditosData?.data ?? []).map((mov, i) => {
                  const entrada = mov.tipo === "entrada"
                  const origemLabel: Record<string, string> = {
                    devolucao: "Devolução", troca: "Troca", venda: "Venda",
                    manual: "Manual", ajuste: "Ajuste",
                  }
                  return (
                    <motion.div key={mov.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                      <div className="mt-0.5 p-1.5 rounded-lg shrink-0"
                        style={{ background: entrada ? "rgba(16,185,129,0.12)" : "rgba(248,113,113,0.12)" }}>
                        {entrada
                          ? <TrendingUp size={13} style={{ color: "#10b981" }} />
                          : <TrendingDown size={13} style={{ color: "#f87171" }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase" style={{ color: entrada ? "#10b981" : "#f87171" }}>
                            {entrada ? "+" : "–"} R$ {mov.valor.toFixed(2).replace(".", ",")}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {new Date(mov.created_at).toLocaleDateString("pt-BR")}
                            </span>
                            <motion.button
                              onClick={() => excluirMovimentacao(mov.id)}
                              disabled={excluindoMovId === mov.id}
                              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                              className="p-1 rounded-md opacity-40 hover:opacity-100 transition-opacity"
                              style={{ color: "#f87171" }}
                              title="Remover movimentação">
                              {excluindoMovId === mov.id
                                ? <Loader2 size={11} className="animate-spin" />
                                : <Trash2 size={11} />}
                            </motion.button>
                          </div>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                          {origemLabel[mov.origem] ?? mov.origem}
                          {mov.operacao_id ? ` #${mov.operacao_id}` : ""}
                          {mov.obs ? ` — ${mov.obs}` : ""}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                          Saldo: R$ {mov.saldo_antes.toFixed(2).replace(".", ",")} → R$ {mov.saldo_depois.toFixed(2).replace(".", ",")}
                          {mov.usuarios?.nome ? ` · ${mov.usuarios.nome}` : ""}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* Aba Etiquetas */}
        {tab === "etiquetas" && <EtiquetasTab cliente={cliente} />}
      </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─── Aba: Histórico de Etiquetas Emitidas ─────────────────
type EtiquetaSnapshot = {
  logradouro?: string; numero?: string; complemento?: string
  bairro?: string; cidade?: string; estado?: string; cep?: string
}
type EtiquetaRow = {
  id: number
  me_order_id: string
  me_protocol: string | null
  me_tracking: string | null
  status: string
  cep_destino: string | null
  responsavel: string | null
  nome_cliente_snapshot: string | null
  endereco_snapshot: EtiquetaSnapshot | null
  tipo_etiqueta: string | null
  quantidade_reimpressoes: number
  data_ultima_reimpressao: string | null
  created_at: string
}
type EtiquetasResp = {
  data: EtiquetaRow[]
  total: number
  resumo: { total_emitidas: number; ultima_emissao: string | null; ultimo_endereco: EtiquetaSnapshot | null }
}

const ET_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pendente",  cls: "bg-amber-500/15 text-amber-400" },
  paid:      { label: "Paga",      cls: "bg-blue-500/15 text-blue-400" },
  released:  { label: "Liberada",  cls: "bg-blue-500/15 text-blue-400" },
  generated: { label: "Gerada",    cls: "bg-indigo-500/15 text-indigo-400" },
  posted:    { label: "Postada",   cls: "bg-violet-500/15 text-violet-400" },
  delivered: { label: "Entregue",  cls: "bg-emerald-500/15 text-emerald-400" },
  canceled:  { label: "Cancelada", cls: "bg-red-500/15 text-red-400" },
}

function enderecoStr(e?: EtiquetaSnapshot | null): string {
  if (!e) return "—"
  return [e.logradouro, e.numero, e.bairro, e.cidade && `${e.cidade}/${e.estado ?? ""}`, e.cep]
    .filter(Boolean).join(", ")
}

function EtiquetasTab({ cliente }: { cliente: Cliente }) {
  const [q, setQ] = useState("")
  const [statusF, setStatusF] = useState("")
  const [de, setDe] = useState("")
  const [ate, setAte] = useState("")
  const [pdfOrderId, setPdfOrderId] = useState<string | null>(null)
  const [reimprimindo, setReimprimindo] = useState<number | null>(null)
  const [copiadoId, setCopiadoId] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null)

  const qs = new URLSearchParams()
  if (q) qs.set("q", q)
  if (statusF) qs.set("status", statusF)
  if (de) qs.set("de", de)
  if (ate) qs.set("ate", ate)

  const { data, isLoading, refetch } = useQuery<EtiquetasResp>({
    queryKey: ["cliente-etiquetas", cliente.id, q, statusF, de, ate],
    queryFn: () => apiGet(`/clientes/${cliente.id}/etiquetas?${qs.toString()}`),
    staleTime: 30_000,
  })

  const etiquetas = data?.data ?? []
  const resumo = data?.resumo

  // Endereço atual do cliente para comparar com o snapshot
  const enderecoAtual: EtiquetaSnapshot = {
    logradouro: cliente.logradouro ?? "", numero: cliente.numero ?? "",
    bairro: cliente.bairro ?? "", cidade: cliente.cidade ?? "",
    estado: cliente.estado ?? "", cep: (cliente.cep ?? "").replace(/\D/g, ""),
  }
  const enderecoMudou = (snap?: EtiquetaSnapshot | null) =>
    snap ? enderecoStr(snap).toUpperCase() !== enderecoStr(enderecoAtual).toUpperCase() : false

  async function reimprimir(et: EtiquetaRow) {
    if (!confirm("Reimprimir esta etiqueta? Será reaberto o mesmo PDF já gerado (não gera nova cobrança).")) return
    setReimprimindo(et.id); setMsg(null)
    try {
      await apiPost(`/etiquetas/${et.id}/reimprimir`, {})
      setPdfOrderId(et.me_order_id)
      setMsg({ tipo: "ok", texto: "Etiqueta reaberta para reimpressão." })
      refetch()
    } catch (e) {
      setMsg({ tipo: "erro", texto: (e as Error).message || "Não foi possível reimprimir." })
    } finally { setReimprimindo(null) }
  }

  async function copiar(et: EtiquetaRow) {
    const txt = [
      `Cliente: ${et.nome_cliente_snapshot ?? cliente.nome}`,
      `Protocolo: ${et.me_protocol ?? "—"}`,
      et.me_tracking ? `Rastreio: ${et.me_tracking}` : null,
      `Tipo: ${et.tipo_etiqueta ?? "—"}`,
      `Endereço: ${enderecoStr(et.endereco_snapshot)}`,
      `Emitida em: ${fmtData(et.created_at)}`,
    ].filter(Boolean).join("\n")
    try { await navigator.clipboard.writeText(txt); setCopiadoId(et.id); setTimeout(() => setCopiadoId(null), 1500) } catch { /* noop */ }
  }

  const STATUS_OPTS = [
    { v: "", l: "Todos status" },
    { v: "released", l: "Liberada" },
    { v: "posted", l: "Postada" },
    { v: "delivered", l: "Entregue" },
    { v: "pending", l: "Pendente" },
    { v: "canceled", l: "Cancelada" },
  ]

  return (
    <div className="space-y-3">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl p-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>Etiquetas</p>
          <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{resumo?.total_emitidas ?? 0}</p>
        </div>
        <div className="rounded-xl p-3 col-span-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>Última emissão</p>
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {resumo?.ultima_emissao ? fmtData(resumo.ultima_emissao) : "—"}
          </p>
        </div>
      </div>
      {resumo?.ultimo_endereco && (
        <div className="rounded-xl px-3 py-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>Último endereço usado</p>
          <p className="text-xs uppercase" style={{ color: "var(--text-secondary)" }}>{enderecoStr(resumo.ultimo_endereco)}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar protocolo/rastreio"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </div>
        <select value={statusF} onChange={e => setStatusF(e.target.value)}
          className="px-2 py-2 rounded-lg text-xs outline-none"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <input type="date" value={de} onChange={e => setDe(e.target.value)} title="De"
          className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <input type="date" value={ate} onChange={e => setAte(e.target.value)} title="Até"
          className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      </div>

      {msg && (
        <p className={cn("text-xs text-center py-1.5 px-3 rounded-lg", msg.tipo === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>{msg.texto}</p>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} /></div>
      ) : etiquetas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <Tag size={32} style={{ color: "var(--border-hover)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhuma etiqueta emitida para este cliente.</p>
        </div>
      ) : etiquetas.map(et => {
        const st = ET_STATUS[et.status] ?? { label: et.status, cls: "bg-slate-500/15 text-slate-400" }
        return (
          <div key={et.id} className="rounded-xl px-4 py-3 space-y-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase truncate" style={{ color: "var(--text-primary)" }}>{et.nome_cliente_snapshot ?? cliente.nome}</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{fmtData(et.created_at)} · {et.tipo_etiqueta ?? "Envio"}</p>
              </div>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0", st.cls)}>{st.label}</span>
            </div>
            <p className="text-[11px] uppercase" style={{ color: "var(--text-secondary)" }}>{enderecoStr(et.endereco_snapshot)}</p>
            <div className="flex items-center gap-2 flex-wrap text-[10px]" style={{ color: "var(--text-muted)" }}>
              {et.me_protocol && <span className="font-mono">{et.me_protocol}</span>}
              {et.responsavel && <span>· por {et.responsavel}</span>}
              {et.quantidade_reimpressoes > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-semibold">Reimpressa {et.quantidade_reimpressoes}×</span>
              )}
            </div>

            {enderecoMudou(et.endereco_snapshot) && (
              <p className="text-[10px] flex items-start gap-1 px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <AlertCircle size={12} className="mt-px shrink-0" />
                O endereço do cadastro mudou desde esta emissão. Para enviar ao novo endereço, gere uma nova etiqueta.
              </p>
            )}

            <div className="flex items-center gap-1 pt-1">
              <button onClick={() => setPdfOrderId(et.me_order_id)} title="Visualizar"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <Eye size={13} /> Visualizar
              </button>
              <button onClick={() => reimprimir(et)} disabled={reimprimindo === et.id} title="Reimprimir"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                {reimprimindo === et.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reimprimir
              </button>
              <button onClick={() => copiar(et)} title="Copiar informações"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: copiadoId === et.id ? "#10b981" : "var(--text-secondary)" }}>
                {copiadoId === et.id ? <Check size={13} /> : <Copy size={13} />} {copiadoId === et.id ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>
        )
      })}

      <AnimatePresence>
        {pdfOrderId && <EtiquetaPDFModal orderId={pdfOrderId} onClose={() => setPdfOrderId(null)} />}
      </AnimatePresence>
    </div>
  )
}

function DrawerCliente({
  cliente, onClose, onEditar, onToggleStatus, onReenviarNotificacao, onEditarCampo,
}: {
  cliente: Cliente
  onClose: () => void
  onEditar: () => void
  onToggleStatus: () => void
  onReenviarNotificacao: () => void
  onEditarCampo?: (step: number) => void
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  const endereco = [
    cliente.logradouro,
    cliente.numero,
    cliente.complemento,
    cliente.bairro,
    cliente.cidade && cliente.estado ? `${cliente.cidade} - ${cliente.estado}` : cliente.cidade ?? cliente.estado,
    cliente.cep,
  ].filter(Boolean).join(", ")

  const inicial = cliente.nome?.trim()[0]?.toUpperCase() ?? "?"

  // Link do WhatsApp (wa.me) — número limpo com DDI 55
  const celDigits = (cliente.celular ?? "").replace(/\D/g, "")
  const waHref = celDigits ? `https://wa.me/${celDigits.startsWith("55") ? celDigits : `55${celDigits}`}` : undefined

  const INFO = [
    { icon: <Phone size={14} />,        label: "WhatsApp",   value: cliente.celular   ?? "—", href: waHref,   step: 5 },
    { icon: <AtSign size={14} />,       label: "Instagram",  value: cliente.instagram ? `@${cliente.instagram.replace(/^@/, "")}` : "—", step: 6 },
    { icon: <FileText size={14} />,     label: "CPF / CNPJ", value: cliente.cpf_cnpj  ?? "—",                step: 3 },
    { icon: <CalendarDays size={14} />, label: "Nascimento", value: cliente.data_nasc ? fmtData(cliente.data_nasc) : "—",               step: 4 },
    { icon: <Home size={14} />,         label: "Endereço",   value: endereco || "—",    full: true,           step: 7, href: endereco ? `https://maps.google.com/?q=${encodeURIComponent(endereco)}` : undefined },
  ]

  // Cores do avatar baseadas na inicial
  const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444"]
  const avatarBg = AVATAR_COLORS[inicial.charCodeAt(0) % AVATAR_COLORS.length]

  return (
    <div className="fixed inset-0 z-50 flex">

      {/* Modal tela cheia */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="relative w-full h-full flex flex-col overflow-hidden"
        style={{
          background: "var(--bg-card)",
          borderRadius: 0,
        }}>

        {/* ── HERO ── */}
        <div className="relative shrink-0 overflow-hidden">
          {/* Gradiente de fundo */}
          <div className="absolute inset-0" style={{
            background: `linear-gradient(135deg, ${avatarBg}28 0%, ${avatarBg}08 50%, transparent 100%)`,
          }} />
          {/* Orbs decorativos */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05, duration: 0.6 }}
            className="absolute pointer-events-none"
            style={{ width: 320, height: 320, top: -120, right: -80, borderRadius: "50%", background: `radial-gradient(circle, ${avatarBg}18 0%, transparent 70%)` }}
          />
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.8 }}
            className="absolute pointer-events-none"
            style={{ width: 180, height: 180, bottom: -60, left: 120, borderRadius: "50%", background: `radial-gradient(circle, ${avatarBg}12 0%, transparent 70%)` }}
          />
          {/* Grid decorativo */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }} />

          {/* Conteúdo hero — linha única compacta */}
          <div className="relative z-10 px-4 sm:px-6 py-3 flex items-center gap-3">
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.08, type: "spring", stiffness: 260, damping: 22 }}
              className="relative shrink-0">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-lg"
                style={{ background: `linear-gradient(135deg, ${avatarBg} 0%, ${avatarBg}cc 100%)`, color: "#fff", boxShadow: `0 4px 16px ${avatarBg}55` }}>
                {inicial}
              </div>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.22, type: "spring" }}
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: "var(--bg-card)", background: cliente.ativo ? "#10b981" : "#64748b" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </motion.div>
            </motion.div>

            {/* Nome + badges */}
            <motion.div
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 }}
              className="flex-1 min-w-0">
              <p className="text-base sm:text-lg font-black uppercase leading-tight tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
                {cliente.nome}
              </p>
              {cliente.apelido && (
                <p className="text-xs font-semibold truncate" style={{ color: avatarBg }}>&ldquo;{cliente.apelido}&rdquo;</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                  cliente.ativo ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/15 text-slate-400"
                )}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: cliente.ativo ? "#10b981" : "#64748b" }} />
                  {cliente.ativo ? "Ativa" : "Inativa"}
                </span>
                {cliente.celular && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                    <Phone size={9} /> {cliente.celular}
                  </span>
                )}
                {cliente.cidade && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                    <MapPin size={9} /> {cliente.cidade}{cliente.estado ? `/${cliente.estado}` : ""}
                  </span>
                )}
              </div>
            </motion.div>

            {/* Ações + X — tudo em uma única linha */}
            <motion.div
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 }}
              className="shrink-0 flex items-center gap-1.5">
              <motion.button onClick={onEditar} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white whitespace-nowrap transition-all"
                style={{ background: `linear-gradient(135deg, ${avatarBg} 0%, ${avatarBg}cc 100%)`, boxShadow: `0 4px 12px ${avatarBg}44` }}>
                <Pencil size={12} /> Editar
              </motion.button>

              {cliente.celular && !["enviado", "autorizado"].includes(cliente.notificacao_status ?? "") && (
                <motion.button onClick={onReenviarNotificacao} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
                  style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25d366" }}>
                  <Send size={11} />
                  {cliente.notificacao_status === "erro" ? "Reenviar" : "Notificar"}
                </motion.button>
              )}
              {cliente.notificacao_status === "enviado" && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
                  style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}>
                  <Clock size={11} /> Aguardando
                </div>
              )}
              {cliente.notificacao_status === "autorizado" && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
                  <CheckCircle2 size={11} /> Autorizado
                </div>
              )}
              {cliente.notificacao_status === "recusado" && (
                <motion.button onClick={onReenviarNotificacao} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
                  style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
                  <Send size={11} /> Reenviar
                </motion.button>
              )}
              <motion.button onClick={onToggleStatus} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
                style={{
                  background: cliente.ativo ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)",
                  border: `1px solid ${cliente.ativo ? "rgba(248,113,113,0.3)" : "rgba(74,222,128,0.3)"}`,
                  color: cliente.ativo ? "#f87171" : "#4ade80",
                }}>
                <Power size={11} />
                {cliente.ativo ? "Desativar" : "Ativar"}
              </motion.button>

              {/* X na mesma linha */}
              <motion.button onClick={onClose}
                className="p-1.5 rounded-xl transition-all"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)" }}
                whileHover={{ scale: 1.1, background: "rgba(248,113,113,0.15)" }}
                whileTap={{ scale: 0.95 }}>
                <X size={15} />
              </motion.button>
            </motion.div>
          </div>

          {/* Linha separadora com gradiente */}
          <div className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${avatarBg}44, transparent)` }} />
        </div>

        {/* ── CORPO COM ABAS ── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
          className="flex-1 min-h-0 overflow-hidden">
          <DrawerContent cliente={cliente} info={INFO} onEditarCampo={onEditarCampo} />
        </motion.div>
      </motion.div>
    </div>
  )
}

// ─── Wizard ───────────────────────────────────────────────
function WizardCliente({
  inicial, editandoId, onClose, onSalvo, quickEdit, initialStep,
}: {
  inicial: ClienteForm | null
  editandoId: number | null
  onClose: () => void
  onSalvo: (id?: number) => void
  quickEdit?: boolean
  initialStep?: number
}) {
  const qc = useQueryClient()
  const [step, setStep]         = useState(initialStep ?? 1)
  const [dir, setDir]           = useState(1)
  const [form, setForm]         = useState<ClienteForm>(inicial ?? EMPTY)
  const [erro, setErro]         = useState("")
  const [saving, setSaving]     = useState(false)
  const [salvoOk, setSalvoOk]   = useState(false)
  const [confete, setConfete]   = useState(false)
  const [cepStatus, setCepStatus] = useState<CepStatus>(
    inicial?.logradouro ? "encontrado" : "idle"
  )
  const [endTexto, setEndTexto]         = useState(
    inicial?.logradouro
      ? [inicial.logradouro, inicial.bairro, inicial.cidade, inicial.estado, inicial.cep].filter(Boolean).join(", ")
      : ""
  )
  const [endSugestoes, setEndSugestoes] = useState<EndSugestao[]>([])
  const [endBuscando, setEndBuscando]   = useState(false)
  const [endAberto, setEndAberto]       = useState(false)
  const [endTimerRef, setEndTimerRef]   = useState<ReturnType<typeof setTimeout> | null>(null)
  const [returnToRevisao, setReturnToRevisao] = useState(!!quickEdit)
  const [waStatus, setWaStatus] = useState<"idle" | "checking" | "ok" | "nok" | "erro">("idle")
  const waTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mostrarEntrega, setMostrarEntrega] = useState(
    !!(inicial?.entrega_logradouro || inicial?.entrega_cep)
  )
  const inputRef = useRef<HTMLInputElement>(null)

  // 10 steps: 1-Nome 2-Apelido 3-CPF 4-Nasc 5-Celular 6-Instagram 7-CEP 8-Endereço 9-Número/Compl 10-Revisão
  const TOTAL = 10

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 280)
    return () => clearTimeout(t)
  }, [step])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  function set(k: keyof ClienteForm, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    setErro("")
  }

  function go(next: number) {
    setDir(next > step ? 1 : -1)
    setStep(next)
    setErro("")
    if (next !== 5) { setWaStatus("idle"); if (waTimerRef.current) clearTimeout(waTimerRef.current) }
  }

  async function buscarCep(cep: string): Promise<boolean> {
    const limpo = cep.replace(/\D/g, "")
    if (limpo.length !== 8) return false
    setCepStatus("buscando")
    try {
      const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
      const d = await r.json()
      if (!d.erro) {
        setForm(f => ({
          ...f,
          logradouro: d.logradouro ?? "",
          bairro:     d.bairro     ?? "",
          cidade:     d.localidade ?? "",
          estado:     d.uf         ?? "",
        }))
        setCepStatus("encontrado")
        return true
      } else {
        setCepStatus("invalido")
        return false
      }
    } catch {
      setCepStatus("invalido")
      return false
    }
  }

  function onEndTextoChange(valor: string) {
    setEndTexto(valor)
    setEndSugestoes([])
    setEndAberto(false)
    if (endTimerRef) clearTimeout(endTimerRef)
    const limpo = valor.replace(/\D/g, "")
    if (!valor.trim()) { setEndBuscando(false); return }
    setEndBuscando(true)

    const timer = setTimeout(async () => {
      try {
        // ── CEP completo (8 dígitos, com ou sem hífen) → ViaCEP direto ──
        if (limpo.length === 8) {
          const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
          const d = await r.json()
          if (!d.erro) {
            const cepFmt = limpo.replace(/^(\d{5})(\d{3})$/, "$1-$2")
            const isRP = normAddr(d.localidade ?? "").includes("ribeirao preto")
            setEndSugestoes([{
              label: "", cep: cepFmt,
              logradouro: d.logradouro ?? "", bairro: d.bairro ?? "",
              cidade: d.localidade ?? "", estado: d.uf ?? "",
              _isRP: isRP, _score: isRP ? 200 : 100,
            }])
            setEndAberto(true)
          } else { setEndSugestoes([]); setEndAberto(false) }
          return
        }

        if (valor.trim().length < 3) { setEndBuscando(false); return }

        // ── Normalização e expansão de abreviações ──────────────
        const valorExpandido = expandAbrev(valor)
        const valorNorm      = normAddr(valorExpandido)

        // ── Extrai complemento (APTO, CASA, BL, etc.) ──────────
        const RE_COMPL = /\b(casa|apto?|ap|bloco|bl|lote|lt|sala|sl|conj|cj|andar|pavimento|pav|kit|kf)\s*\.?\s*[\d\w]*/gi
        const complementoExtraido = (valorExpandido.match(RE_COMPL) ?? []).join(" ").trim()
        const valorSemCompl = valorExpandido.replace(RE_COMPL, " ").replace(/\s+/g, " ").trim()

        // ── Extrai número de rua ─────────────────────────────────
        const numero = valorSemCompl.match(/\b(\d{1,5})\b/)?.[1] ?? ""

        // ── Detecta UF ──────────────────────────────────────────
        const ufDetect = valor.match(/\b(SP|RJ|MG|BA|PR|RS|SC|GO|PE|CE|MA|PA|ES|PB|RN|AL|PI|MT|MS|DF|SE|TO|RO|AC|AP|AM|RR)\b/i)?.[1]?.toUpperCase() ?? "SP"

        // ── Detecta cidade ──────────────────────────────────────
        const CIDADES: Record<string, string> = {
          "ribeirao preto": "Ribeirão Preto", "ribeirão preto": "Ribeirão Preto",
          "ribeirao": "Ribeirão Preto", "rp": "Ribeirão Preto",
          "sao paulo": "São Paulo", "são paulo": "São Paulo", "sp": "São Paulo",
          "campinas": "Campinas", "sorocaba": "Sorocaba",
          "santos": "Santos", "guarulhos": "Guarulhos", "osasco": "Osasco",
          "bauru": "Bauru", "sao jose do rio preto": "São José do Rio Preto",
          "franca": "Franca", "araras": "Araras", "araraquara": "Araraquara",
          "belo horizonte": "Belo Horizonte", "bh": "Belo Horizonte",
          "rio de janeiro": "Rio de Janeiro", "rj": "Rio de Janeiro",
          "curitiba": "Curitiba", "florianopolis": "Florianópolis", "porto alegre": "Porto Alegre",
          "goiania": "Goiânia", "brasilia": "Brasília", "salvador": "Salvador",
          "recife": "Recife", "fortaleza": "Fortaleza", "manaus": "Manaus",
          "jardinopolis": "Jardinópolis", "serrana": "Serrana", "pontal": "Pontal",
          "brodowski": "Brodowski", "sertaozinho": "Sertãozinho", "barrinha": "Barrinha",
          "dumont": "Dumont", "cravinhos": "Cravinhos", "luis antonio": "Luís Antônio",
          "santa rosa de viterbo": "Santa Rosa de Viterbo", "serra azul": "Serra Azul",
          "pradopolis": "Pradópolis", "guatapara": "Guatapará", "motuca": "Motuca",
          "pitangueiras": "Pitangueiras", "sertanopolis": "Sertanópolis",
        }
        // Verifica se usuário especificou explicitamente uma cidade
        const cidadeExplicita = Object.entries(CIDADES)
          .sort((a, b) => b[0].length - a[0].length)
          .find(([k]) => valorNorm.includes(normAddr(k)))?.[1] ?? null

        // ── Isola logradouro removendo números, cidade, UF, complemento ──
        const semNumero = valorSemCompl.replace(/\b\d{1,5}\b/g, " ").replace(/\s+/g, " ").trim()
        const escapeRe  = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const todasCidadesRe = Object.keys(CIDADES).map(k => escapeRe(normAddr(k))).join("|")
        const somenteRua = normAddr(semNumero)
          .replace(new RegExp(`(${todasCidadesRe})`, "gi"), " ")
          .replace(new RegExp(`\\b(SP|RJ|MG|BA|PR|RS|SC|GO|PE|CE|MA|PA|ES|PB|RN|AL|PI|MT|MS|DF)\\b`, "gi"), " ")
          .replace(/[,.\-]/g, " ").replace(/\s+/g, " ").trim()

        // Remove prefixo de tipo de logradouro para ViaCEP (que busca só pelo nome)
        const nomeRua = somenteRua
          .replace(/^(rua|avenida|travessa|alameda|praca|estrada|rodovia|largo|beco|viela|vila)\s+/i, "")
          .trim()

        if (nomeRua.length < 3) { setEndBuscando(false); return }

        if (complementoExtraido) (window as unknown as Record<string, unknown>).__endComplemento = complementoExtraido

        // ── Pontuação de relevância ─────────────────────────────
        function scoreSugestao(s: EndSugestao, query: string): number {
          let sc = 0
          const cn = normAddr(s.cidade)
          const ln = normAddr(s.logradouro)
          const bn = normAddr(s.bairro)
          const qn = normAddr(query)
          if (cn.includes("ribeirao preto")) sc += 200
          if (ln.includes(qn) || qn.includes(ln.replace(/^(rua|avenida|travessa|alameda) /, ""))) sc += 80
          if (ln.startsWith(qn.split(" ").slice(0, 2).join(" "))) sc += 40
          if (bn && qn.includes(bn)) sc += 20
          if (s.cep) sc += 10
          return sc
        }

        // ── Dedup + coletor ─────────────────────────────────────
        const seen = new Set<string>()
        const resultados: EndSugestao[] = []
        function addResult(s: EndSugestao) {
          const k = normAddr(`${s.logradouro}|${s.bairro}|${s.cidade}`)
          if (seen.has(k) || !s.logradouro) return
          seen.add(k)
          s._score = scoreSugestao(s, somenteRua)
          s._isRP  = normAddr(s.cidade).includes("ribeirao preto")
          resultados.push(s)
        }

        // ── FONTE A: ViaCEP – Ribeirão Preto (sempre) ──────────
        const fetchViaCEP = async (uf: string, cidade: string, rua: string) => {
          try {
            const url = `https://viacep.com.br/ws/${uf}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`
            const r = await fetch(url)
            const items = await r.json() as Array<{ logradouro: string; bairro: string; localidade: string; uf: string; cep: string }>
            if (Array.isArray(items)) {
              for (const it of items.slice(0, 8))
                addResult({ label: "", cep: it.cep, logradouro: it.logradouro, bairro: it.bairro, cidade: it.localidade, estado: it.uf })
            }
          } catch { /* continua */ }
        }

        // ── FONTE B: Nominatim nacional (sem restrição de cidade) ──
        const nomHeaders = { "User-Agent": "Brecho Bellasu App" }
        const fetchNominatim = async (query: string, limit = 6) => {
          try {
            const q = encodeURIComponent(`${query}, Brasil`)
            const r = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${q}&format=json&addressdetails=1&countrycodes=br&limit=${limit}&accept-language=pt-BR`,
              { headers: nomHeaders }
            )
            const items = await r.json() as Array<{ address: Record<string, string> }>
            for (const item of items) {
              const a = item.address ?? {}
              if (!a.road && !a.pedestrian && !a.footway) continue
              const uf = ESTADO_SIGLA[a.state ?? ""] ?? ufDetect
              const cepRaw = (a.postcode ?? "").replace(/\D/g, "")
              const s: EndSugestao = {
                label: "",
                cep: cepRaw.length === 8 ? cepRaw.replace(/^(\d{5})(\d{3})$/, "$1-$2") : "",
                logradouro: a.road ?? a.pedestrian ?? a.footway ?? "",
                bairro: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.district ?? "",
                cidade: a.city ?? a.town ?? a.village ?? a.municipality ?? "",
                estado: uf,
              }
              // Enriquece CEP quando Nominatim não trouxe
              if (!s.cep && s.cidade && s.logradouro) {
                try {
                  const rn = s.logradouro.replace(/^(rua|avenida|av\.?)\s+/i, "")
                  const vr = await fetch(`https://viacep.com.br/ws/${uf}/${encodeURIComponent(s.cidade)}/${encodeURIComponent(rn)}/json/`)
                  const vi = await vr.json() as Array<{ cep: string; bairro: string }>
                  if (Array.isArray(vi) && vi[0]) { s.cep = vi[0].cep; if (!s.bairro) s.bairro = vi[0].bairro }
                } catch { /* sem cep */ }
              }
              addResult(s)
            }
          } catch { /* continua */ }
        }

        // Executa buscas em paralelo:
        // 1. ViaCEP Ribeirão Preto (sempre)
        // 2. ViaCEP cidade explícita (se diferente de RP)
        // 3. Nominatim nacional
        const promises: Promise<void>[] = [
          fetchViaCEP("SP", "Ribeirão Preto", nomeRua),
          fetchNominatim(numero ? `${somenteRua} ${numero}` : somenteRua, 8),
        ]
        if (cidadeExplicita && normAddr(cidadeExplicita) !== "ribeirao preto") {
          promises.push(fetchViaCEP(ufDetect, cidadeExplicita, nomeRua))
        }

        await Promise.all(promises)

        // Salva número para injetar no campo ao selecionar
        if (numero) resultados.forEach(s => { s._numero = numero })

        // ── Ordenação final por score (RP sempre no topo) ───────
        resultados.sort((a, b) => {
          if (a._isRP && !b._isRP) return -1
          if (!a._isRP && b._isRP) return 1
          return (b._score ?? 0) - (a._score ?? 0)
        })

        // Remove duplicatas residuais com mesmo logradouro+bairro+cidade
        const final = resultados.filter((s, i, arr) =>
          arr.findIndex(x => normAddr(`${x.logradouro}|${x.bairro}|${x.cidade}`) === normAddr(`${s.logradouro}|${s.bairro}|${s.cidade}`)) === i
        )

        setEndSugestoes(final)
        setEndAberto(final.length > 0)
      } catch { /* sem resultado */ } finally { setEndBuscando(false) }
    }, 350)
    setEndTimerRef(timer)
  }

  function selecionarEndereco(s: EndSugestao) {
    const numero = (s as EndSugestao & { _numero?: string })._numero ?? ""
    const complementoAuto = ((window as unknown as Record<string, unknown>).__endComplemento as string | undefined) ?? ""
    setForm(f => ({
      ...f,
      cep: s.cep,
      logradouro: s.logradouro,
      bairro: s.bairro,
      cidade: s.cidade,
      estado: s.estado,
      ...(numero ? { numero } : {}),
      ...(complementoAuto && !f.complemento ? { complemento: complementoAuto.toUpperCase() } : {}),
    }))
    setEndTexto([s.logradouro, s.bairro, s.cidade, s.estado, s.cep].filter(Boolean).join(", "))
    setEndSugestoes([]); setEndAberto(false)
    delete (window as unknown as Record<string, unknown>).__endComplemento
    setCepStatus("encontrado")
    setTimeout(() => go(8), 180)
  }

  async function advanceCep() {
    // Já selecionou endereço via sugestão → step 8
    if (cepStatus === "encontrado" || cepStatus === "manual") { go(8); return }
    // Campo vazio → avança para preenchimento manual
    if (!endTexto.trim()) { go(8); return }
    // Aguardando busca → avança mesmo assim
    go(8)
  }

  function ativarManual() {
    setCepStatus("manual")
    setErro("")
  }

  function advance() {
    if (step === 1 && form.nome.trim().length < 2) {
      setErro("Nome deve ter pelo menos 2 caracteres")
      return
    }
    // Step 3 = CPF/CNPJ: valida com o MESMO Value Object do servidor
    // (fonte única de verdade). Vazio é permitido; inválido bloqueia.
    if (step === 3 && form.cpf_cnpj.trim()) {
      const r = CpfCnpj.criar(form.cpf_cnpj)
      if (!r.ok) { setErro(r.error.message); return }
    }
    if (step === 7) { advanceCep(); return }
    if (step === 9 && !form.numero.trim()) { setErro("Número é obrigatório."); return }
    if (returnToRevisao) {
      // Edição de endereço: steps 7→8→9 devem fluir em sequência antes de salvar
      if (quickEdit && initialStep === 7 && step < 9) { go(step + 1); return }
      if (quickEdit) { handleSalvar(); return }
      setReturnToRevisao(false); go(TOTAL); return
    }
    if (step < TOTAL) go(step + 1)
  }

  async function handleSalvar() {
    setSaving(true)
    setErro("")
    try {
      const payload = {
        nome:        form.nome.trim(),
        apelido:     form.apelido     || null,
        cpf_cnpj:    form.cpf_cnpj    || null,
        data_nasc:   form.data_nasc   || null,
        celular:     form.celular     || null,
        instagram:   form.instagram   || null,
        cep:         form.cep         || null,
        logradouro:  form.logradouro  || null,
        numero:      form.numero      || null,
        complemento: form.complemento || null,
        bairro:      form.bairro      || null,
        cidade:      form.cidade      || null,
        estado:      form.estado      || null,
        entrega_cep:         form.entrega_cep         || null,
        entrega_logradouro:  form.entrega_logradouro  || null,
        entrega_numero:      form.entrega_numero      || null,
        entrega_complemento: form.entrega_complemento || null,
        entrega_bairro:      form.entrega_bairro      || null,
        entrega_cidade:      form.entrega_cidade      || null,
        entrega_estado:      form.entrega_estado      || null,
      }
      let savedId: number | undefined
      if (editandoId) await apiPut(`/clientes/${editandoId}`, payload)
      else {
        const res = await apiPost<{ id: number }>("/clientes", payload)
        savedId = res.id
      }
      qc.invalidateQueries({ queryKey: ["clientes"] })
      if (quickEdit) {
        onSalvo(savedId)
        return
      }
      // Celebração ✨
      setSalvoOk(true)
      setConfete(true)
      setTimeout(() => setConfete(false), 1200)
      setTimeout(() => { setSalvoOk(false); onSalvo(savedId) }, 2200)
    } catch (err) {
      setErro((err as Error).message || "Erro ao salvar. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step < TOTAL) { e.preventDefault(); advance() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, cepStatus, returnToRevisao])

  const inputBase = `
    w-full px-5 py-4 text-lg rounded-2xl outline-none transition-all border-2
    focus:border-[color:var(--accent)]
  `
  const inputStyle: React.CSSProperties = {
    background: "var(--bg-surface)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
  }

  const enderecoFormatado = [
    form.logradouro,
    form.numero      && `nº ${form.numero}`,
    form.complemento,
    form.bairro,
    form.cidade && form.estado ? `${form.cidade} – ${form.estado}` : form.cidade || form.estado,
    form.cep         && `CEP ${form.cep}`,
  ].filter(Boolean).join(", ")

  return (
    <>
    <Confete show={confete} />
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "var(--bg-base)" }}
    >
      <SuccessOverlay show={salvoOk} titulo={editandoId ? "Cliente atualizado!" : "Cliente cadastrado!"} subtitulo={form.nome || ""} />
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>Brechó Bellasu</span>
          <span style={{ color: "var(--border-hover)" }}>|</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {editandoId ? "Editar Cliente" : "Novo Cliente"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium tabular-nums" style={{ color: "var(--text-muted)" }}>
            {step} / {TOTAL}
          </span>
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
            <X size={15} /> Cancelar
          </button>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div className="flex-1 overflow-hidden relative" onKeyDown={handleKey}>
        <AnimatePresence custom={dir} mode="wait">

          {/* Steps 1–6 */}
          {step < TOTAL ? (
            <motion.div key={step} custom={dir}
              variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="absolute inset-0 flex flex-col items-center justify-center px-6"
            >
              <div className="w-full max-w-xl">
                {/* Número */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base font-bold" style={{ color: "var(--accent)" }}>{step}</span>
                  <ArrowRight size={14} style={{ color: "var(--accent)" }} />
                </div>

                {/* ── Step 1: Nome ── */}
                {step === 1 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Qual é o nome completo do cliente?
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Este é o único campo obrigatório.</p>
                    <input ref={inputRef} value={form.nome} onChange={e => set("nome", e.target.value)}
                      placeholder="EX: MARIA APARECIDA SILVA"
                      className={inputBase} style={inputStyle} autoComplete="off" />
                  </>
                )}

                {/* ── Step 2: Apelido ── */}
                {step === 2 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Tem apelido?
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                      Como a cliente é conhecida na loja. Opcional.
                    </p>
                    <input ref={inputRef} value={form.apelido}
                      onChange={e => set("apelido", e.target.value.toUpperCase())}
                      placeholder="EX: MARI, CIDA, BETH..."
                      className={inputBase} style={{ ...inputStyle, textTransform: "uppercase" }} autoComplete="off" />
                  </>
                )}

                {/* ── Step 3: CPF/CNPJ ── */}
                {step === 3 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      CPF ou CNPJ do cliente?
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Opcional. Usado para identificação fiscal.</p>
                    <input ref={inputRef} value={form.cpf_cnpj} onChange={e => set("cpf_cnpj", e.target.value)}
                      placeholder="00000000000"
                      className={inputBase} style={inputStyle} autoComplete="off" />
                  </>
                )}

                {/* ── Step 4: Nascimento ── */}
                {step === 4 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Data de nascimento?
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                      Digite diretamente ou clique no{" "}
                      <CalendarDays size={13} className="inline-block" style={{ color: "var(--accent)", verticalAlign: "middle" }} />{" "}
                      para abrir o calendário.
                    </p>
                    <DatePicker value={form.data_nasc} onChange={v => set("data_nasc", v)}
                      inputClassName={inputBase}
                      max={new Date().toISOString().split("T")[0]}
                      textFirst
                      textInputRef={inputRef} />
                  </>
                )}

                {/* ── Step 5: Celular ── */}
                {step === 5 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Celular (WhatsApp)?
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Com DDD. Usado para comunicados e confirmações.</p>
                    <input ref={inputRef} type="tel" value={form.celular}
                      onChange={e => {
                        set("celular", e.target.value)
                        setWaStatus("idle")
                        if (waTimerRef.current) clearTimeout(waTimerRef.current)
                        const digits = e.target.value.replace(/\D/g, "")
                        if (digits.length >= 10) {
                          waTimerRef.current = setTimeout(async () => {
                            setWaStatus("checking")
                            try {
                              const res = await apiPost<{ valido: boolean | null }>("/clientes/validar-whatsapp", { celular: e.target.value })
                              setWaStatus(res.valido === true ? "ok" : res.valido === false ? "nok" : "erro")
                            } catch { setWaStatus("erro") }
                          }, 900)
                        }
                      }}
                      placeholder="(16) 9 9999-9999"
                      className={inputBase} style={inputStyle} />
                    {waStatus !== "idle" && (
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        {waStatus === "checking" && <><Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} /><span style={{ color: "var(--text-muted)" }}>Verificando no WhatsApp…</span></>}
                        {waStatus === "ok"       && <><CheckCircle2 size={14} style={{ color: "#25d366" }} /><span style={{ color: "#25d366" }}>Número encontrado no WhatsApp ✓</span></>}
                        {waStatus === "nok"      && <><XCircle size={14} style={{ color: "#f87171" }} /><span style={{ color: "#f87171" }}>Número não encontrado no WhatsApp</span></>}
                        {waStatus === "erro"     && <><AlertCircle size={14} style={{ color: "#fbbf24" }} /><span style={{ color: "#fbbf24" }}>Não foi possível verificar agora</span></>}
                      </div>
                    )}
                  </>
                )}

                {/* ── Step 6: Instagram ── */}
                {step === 6 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Instagram da cliente?
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Opcional. Usado para identificação nas lives e comunicação.</p>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-bold select-none"
                        style={{ color: "var(--text-muted)" }}>@</span>
                      <input ref={inputRef} value={form.instagram}
                        onChange={e => set("instagram", e.target.value.toUpperCase().replace(/^@/, ""))}
                        placeholder="USUARIODACLIENTE"
                        className={cn(inputBase, "pl-12")} style={inputStyle} autoComplete="off" />
                    </div>
                  </>
                )}

                {/* ── Step 7: CEP ── */}
                {step === 7 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Qual o endereço?
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                      CEP, nome da rua, endereço completo com número ou complemento — buscamos automaticamente.
                    </p>

                    <div className="relative">
                      <input
                        ref={inputRef}
                        value={endTexto}
                        onChange={e => onEndTextoChange(e.target.value)}
                        onFocus={() => { if (endSugestoes.length > 0) setEndAberto(true) }}
                        onBlur={() => setTimeout(() => setEndAberto(false), 180)}
                        placeholder="Ex: 14085-520 · Rua Ceará 1687 Casa 57 · Av. Brasil 200 Apto 3"
                        className={inputBase}
                        style={{
                          ...inputStyle,
                          borderColor: cepStatus === "encontrado" ? "#10b981" : "var(--border)",
                        }}
                        autoComplete="off"
                      />
                      {endBuscando && (
                        <Loader2 size={18} className="animate-spin absolute right-4 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--accent)" }} />
                      )}
                      {cepStatus === "encontrado" && !endBuscando && (
                        <Check size={18} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "#10b981" }} />
                      )}

                      {/* Dropdown de sugestões */}
                      <AnimatePresence>
                        {endAberto && endSugestoes.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="absolute left-0 right-0 top-full mt-1 z-50 rounded-2xl shadow-xl overflow-hidden"
                            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                            {/* Cabeçalho com contador */}
                            {endSugestoes.length > 1 && (
                              <div className="px-4 py-2 flex items-center justify-between"
                                style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                                  {endSugestoes.length} resultado{endSugestoes.length > 1 ? "s" : ""} encontrado{endSugestoes.length > 1 ? "s" : ""}
                                </span>
                                {endSugestoes.some(s => s._isRP) && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    style={{ background: "rgba(var(--accent-rgb,99,102,241),0.12)", color: "var(--accent)" }}>
                                    RP prioridade
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Lista com scroll após 3 itens */}
                            <div style={{ maxHeight: "calc(3 * 68px)", overflowY: "auto" }}>
                              {endSugestoes.map((s, i) => (
                                <button key={i} onMouseDown={() => selecionarEndereco(s)}
                                  className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors"
                                  style={{ borderBottom: i < endSugestoes.length - 1 ? "1px solid var(--border)" : "none" }}
                                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-surface)")}
                                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                                  <MapPin size={14} className="mt-0.5 shrink-0"
                                    style={{ color: s._isRP ? "var(--accent)" : "var(--text-muted)" }} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                                        {[s.logradouro, s._numero, s.bairro].filter(Boolean).join(", ") || s.label.split(",")[0]}
                                      </p>
                                      {s._isRP && (
                                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                          style={{ background: "rgba(var(--accent-rgb,99,102,241),0.15)", color: "var(--accent)" }}>
                                          RP
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                                      {[s.cidade, s.estado, s.cep].filter(Boolean).join(" · ")}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <AnimatePresence>
                      {cepStatus === "encontrado" && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="mt-4 flex items-start gap-3 px-4 py-3 rounded-2xl"
                          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
                          <MapPin size={16} className="mt-0.5 shrink-0" style={{ color: "#10b981" }} />
                          <div>
                            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              {[form.logradouro, form.bairro].filter(Boolean).join(", ")}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {[form.cidade, form.estado].filter(Boolean).join(" – ")} · Você poderá editar na próxima etapa
                            </p>
                          </div>
                        </motion.div>
                      )}
                      {endTexto.length > 3 && !endBuscando && endSugestoes.length === 0 && cepStatus !== "encontrado" && !endAberto && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="mt-4 flex items-center gap-2 px-4 py-3 rounded-2xl"
                          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
                          <AlertCircle size={15} style={{ color: "#f87171" }} />
                          <p className="text-sm" style={{ color: "#f87171" }}>
                            Endereço não encontrado — você poderá preencher manualmente na próxima etapa.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {/* ── Step 8: Endereço (conferência + edição) ── */}
                {step === 8 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Confirme o endereço
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                      {cepStatus === "encontrado"
                        ? "Confira o endereço encontrado e edite se necessário."
                        : "Preencha o endereço manualmente."}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                          Logradouro *
                        </p>
                        <input ref={inputRef} value={form.logradouro} onChange={e => set("logradouro", e.target.value)}
                          placeholder="Rua, Avenida, Travessa..."
                          className={inputBase} style={inputStyle} autoComplete="off" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Bairro</p>
                          <input value={form.bairro} onChange={e => set("bairro", e.target.value)}
                            placeholder="Bairro"
                            className={cn(inputBase, "!text-base !py-3")} style={inputStyle} autoComplete="off" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Cidade</p>
                          <input value={form.cidade} onChange={e => set("cidade", e.target.value)}
                            placeholder="Cidade"
                            className={cn(inputBase, "!text-base !py-3")} style={inputStyle} autoComplete="off" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Estado (UF)</p>
                        <input value={form.estado} onChange={e => set("estado", e.target.value.toUpperCase())}
                          placeholder="SP" maxLength={2}
                          className={cn(inputBase, "!text-base !py-3 !w-24")} style={inputStyle} autoComplete="off" />
                      </div>
                    </div>
                  </>
                )}

                {/* ── Step 9: Número e Complemento ── */}
                {step === 9 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Número e complemento?
                    </h1>
                    <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>
                      {form.logradouro
                        ? <span style={{ color: "var(--text-secondary)" }}>{form.logradouro}{form.bairro ? `, ${form.bairro}` : ""}</span>
                        : "Apto, casa, bloco, etc."}
                    </p>
                    <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>Número obrigatório · Complemento opcional</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                          Número *
                        </p>
                        <input ref={inputRef} value={form.numero} onChange={e => set("numero", e.target.value)}
                          placeholder="EX: 123"
                          className={inputBase}
                          style={{ ...inputStyle, borderColor: erro && !form.numero.trim() ? "#f87171" : "var(--border)" }}
                          autoComplete="off" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                          Complemento <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opcional)</span>
                        </p>
                        <input value={form.complemento} onChange={e => set("complemento", e.target.value)}
                          placeholder="APTO, CASA, BLOCO..."
                          className={inputBase} style={inputStyle} autoComplete="off" />
                      </div>
                    </div>
                  </>
                )}

                {/* Erro */}
                <AnimatePresence>
                  {erro && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-3 text-sm" style={{ color: "#f87171" }}>
                      {erro}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Botões de ação */}
                <div className="flex items-center gap-4 mt-8">
                  <button onClick={advance} disabled={cepStatus === "buscando"}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg transition-opacity disabled:opacity-50"
                    style={{ background: "var(--accent)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                    {cepStatus === "buscando" ? <><Loader2 size={14} className="animate-spin" /> Buscando...</> :
                     saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> :
                     quickEdit && returnToRevisao ? <><Check size={14} /> Salvar alteração</> :
                     step === 1 ? <>OK, continuar <ArrowRight size={15} /></> :
                     <>Continuar <ArrowRight size={15} /></>}
                  </button>
                  {step > 1 && cepStatus !== "buscando" && (
                    <button onClick={() => { if (returnToRevisao) { setReturnToRevisao(false); go(TOTAL) } else go(step + 1) }}
                      className="text-sm font-medium transition-colors"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                      {returnToRevisao ? "← Voltar ao resumo" : "Pular →"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

          ) : (
            /* ── Step 10: Revisão ── */
            <motion.div key="revisao" custom={dir}
              variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="absolute inset-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden"
            >
              {/* Sidebar */}
              <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col items-center justify-between py-4 md:py-10 px-5 md:px-6 gap-4 md:gap-0"
                style={{ background: "var(--accent)" }}>
                <div className="flex flex-row md:flex-col items-center gap-4 md:text-center">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-full flex items-center justify-center text-xl md:text-2xl font-bold"
                      style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
                      {form.nome?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center bg-emerald-500">
                      <Check size={10} color="#fff" className="md:hidden" />
                      <Check size={14} color="#fff" className="hidden md:block" />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-sm md:text-lg leading-tight text-white uppercase">{form.nome || "—"}</p>
                    <p className="text-xs mt-1 hidden md:block" style={{ color: "rgba(255,255,255,0.6)" }}>
                      Revise os dados antes de salvar
                    </p>
                  </div>
                </div>
                <div className="flex flex-row md:flex-col gap-2 md:w-full shrink-0">
                  <button onClick={handleSalvar} disabled={saving}
                    className="py-2.5 md:py-3 px-4 md:px-0 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 md:w-full"
                    style={{ background: "#fff", color: "var(--accent)" }}>
                    {saving ? <><Loader2 size={15} className="animate-spin" />Salvando...</> : "Salvar"}
                  </button>
                  <button onClick={onClose}
                    className="py-2.5 px-4 md:px-0 rounded-2xl text-sm font-medium md:w-full"
                    style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}>
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Painel revisão */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-10" style={{ background: "var(--bg-base)" }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-6"
                  style={{ color: "var(--text-muted)" }}>
                  ◎ Dados do Cliente
                </h2>

                {erro && (
                  <p className="mb-4 text-sm px-4 py-2 rounded-xl"
                    style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>
                    {erro}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Nome",       value: form.nome || "—",                                 s: 1, full: true },
                    { label: "Apelido",    value: form.apelido || "—",                              s: 2             },
                    { label: "CPF / CNPJ", value: form.cpf_cnpj || "—",                            s: 3             },
                    { label: "Nascimento", value: form.data_nasc ? fmtData(form.data_nasc) : "—",   s: 4             },
                    { label: "Celular",    value: form.celular || "—",                               s: 5             },
                    { label: "Instagram",  value: form.instagram ? `@${form.instagram.replace(/^@/, "")}` : "—",      s: 6             },
                    { label: "Endereço",   value: enderecoFormatado || "—",                          s: 7, full: true },
                  ].map(({ label, value, s, full }) => (
                    <div key={label}
                      className={cn("rounded-2xl p-4", full ? "col-span-2" : "")}
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border)",
                        borderLeft: "3px solid var(--accent)",
                      }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                        {label}
                      </p>
                      <p className="text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>{value}</p>
                      <button onClick={() => { setReturnToRevisao(true); go(s) }}
                        className="flex items-center gap-1 text-xs mt-1.5 font-semibold uppercase tracking-wide transition-opacity"
                        style={{ color: "var(--accent)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.65" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                        <Pencil size={9} /> EDITAR
                      </button>
                    </div>
                  ))}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      {step < TOTAL && (
        <div className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}>
          {step > 1 ? (
            <button onClick={() => go(step - 1)}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)" }}>
              <ChevronLeft size={15} /> Voltar
            </button>
          ) : <span />}
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Pressione{" "}
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Enter
            </kbd>{" "}
            para avançar
          </p>
        </div>
      )}
    </motion.div>
    </>
  )
}

// ─── Badge de status de notificação ──────────────────────
function BadgeNotificacao({ status }: { status?: string | null }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    pendente:   { bg: "bg-amber-500/10",   text: "text-amber-400",   icon: <Clock size={10} />,        label: "Pendente"    },
    enviado:    { bg: "bg-amber-500/10",   text: "text-amber-400",   icon: <Send size={10} />,          label: "Enviado"     },
    autorizado: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: <CheckCircle2 size={10} />,  label: "Autorizado"  },
    recusado:   { bg: "bg-red-500/10",     text: "text-red-400",     icon: <XCircle size={10} />,       label: "Recusado"    },
    erro:       { bg: "bg-red-500/10",     text: "text-red-400",     icon: <XCircle size={10} />,       label: "Erro"        },
  }
  if (!status || !map[status]) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full uppercase bg-slate-500/10 text-slate-400">
      <BellOff size={10} /> Não enviado
    </span>
  )
  const { bg, text, icon, label } = map[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${bg} ${text}`}>
      {icon} {label}
    </span>
  )
}

// ─── Página ───────────────────────────────────────────────
function ClientesPageInner() {
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [busca, setBusca]         = useState("")
  const buscaDebounced            = useDebounce(busca, 350)
  const [status, setStatus]       = useState("ativos")
  const [toggleLoadingId, setToggleLoadingId] = useState<number | null>(null)
  const [toggleToast, setToggleToast] = useState<{ ativo: boolean } | null>(null)
  const [quickEditStep, setQuickEditStep] = useState<number | null>(null)
  const [wizard, setWizard]       = useState(false)
  const [fromVendas, setFromVendas] = useState(false)
  const [editForm, setEditForm]   = useState<ClienteForm | null>(null)
  const [editId, setEditId]       = useState<number | null>(null)
  const [drawer, setDrawer]       = useState<Cliente | null>(null)
  const [reenvioMsg, setReenvioMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [reenvioLoading, setReenvioLoading] = useState(false)

  useEffect(() => {
    const novo = searchParams.get("novo")
    const from = searchParams.get("from")
    const nome = searchParams.get("nome") ?? ""
    if (novo !== "1") return
    router.replace("/clientes", { scroll: false })
    if (from === "vendas") setFromVendas(true)
    setEditForm(nome ? { ...EMPTY, nome } : null)
    setEditId(null)
    setWizard(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function reenviarNotificacao(cliente: Cliente) {
    setReenvioLoading(true); setReenvioMsg(null)
    try {
      await apiPatch(`/clientes/${cliente.id}/consentimento`, { acao: "enviar" })
      setReenvioMsg({ ok: true, texto: "✅ Mensagem enviada! Aguardando resposta do cliente." })
      qc.invalidateQueries({ queryKey: ["clientes"] })
      setDrawer(prev => prev ? { ...prev, notificacao_status: "enviado" } : prev)
    } catch (e: unknown) {
      const msg = (e as Error).message || "Erro ao enviar notificação."
      setReenvioMsg({ ok: false, texto: msg })
      qc.invalidateQueries({ queryKey: ["clientes"] })
      setDrawer(prev => prev ? { ...prev, notificacao_status: "erro" } : prev)
    } finally { setReenvioLoading(false) }
  }

  const statusParam = status === "inativos" ? "inativo" : status === "todos" ? "todos" : undefined

  const { data, isLoading } = useQuery<{ data: Cliente[]; total: number }>({
    queryKey: ["clientes", buscaDebounced, statusParam],
    queryFn: () => {
      const qs = new URLSearchParams({
        limit: "500",
        ...(buscaDebounced && { busca: buscaDebounced }),
        ...(statusParam && { status: statusParam }),
      }).toString()
      return apiGet(`/clientes?${qs}`)
    },
    staleTime: 30_000,
  })

  const toggleStatus = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      apiPatch(`/clientes/${id}/status`, { ativo }),
    onMutate: ({ id }) => setToggleLoadingId(id),
    onSettled: () => setToggleLoadingId(null),
    onSuccess: (_data, { ativo }) => {
      qc.invalidateQueries({ queryKey: ["clientes"] })
      setToggleToast({ ativo })
      setTimeout(() => setToggleToast(null), 3000)
    },
  })

  function abrirDrawer(c: Cliente) {
    setDrawer(c)
  }

  function buildEditForm(c: Cliente): ClienteForm {
    return {
      nome: c.nome, apelido: c.apelido ?? "", cpf_cnpj: c.cpf_cnpj ?? "", data_nasc: c.data_nasc ?? "",
      celular: c.celular ?? "", instagram: c.instagram ?? "",
      cep: c.cep ?? "", logradouro: c.logradouro ?? "", numero: c.numero ?? "",
      complemento: c.complemento ?? "", bairro: c.bairro ?? "",
      cidade: c.cidade ?? "", estado: c.estado ?? "",
      entrega_cep: c.entrega_cep ?? "", entrega_logradouro: c.entrega_logradouro ?? "",
      entrega_numero: c.entrega_numero ?? "", entrega_complemento: c.entrega_complemento ?? "",
      entrega_bairro: c.entrega_bairro ?? "", entrega_cidade: c.entrega_cidade ?? "",
      entrega_estado: c.entrega_estado ?? "",
    }
  }

  function abrirEdicao(c: Cliente) {
    setDrawer(null)
    setQuickEditStep(null)
    setEditId(c.id)
    setEditForm(buildEditForm(c))
    setWizard(true)
  }

  function abrirEdicaoRapida(c: Cliente, step: number) {
    setQuickEditStep(step)
    setEditId(c.id)
    setEditForm(buildEditForm(c))
    setWizard(true)
  }

  const clientes = data?.data ?? []

  const [tableFocused, setTableFocused] = useState(false)
  const { sel, onKeyDown: tableKeyDown, reset: resetSel } = useTableKeyNav(clientes, (c) => abrirDrawer(c))

  return (
    <div>
      {/* Header + Filtros — sticky colado ao topo do scroll */}
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-6 px-3 sm:px-6 pb-4 pt-3 space-y-3"
        style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border)", boxShadow: "0 4px 24px -6px rgba(0,0,0,0.22)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>Clientes</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{data?.total ?? 0} registros</p>
          </div>
          <button
            onClick={() => { setEditForm(null); setEditId(null); setWizard(true) }}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white shadow-lg transition-opacity"
            style={{ background: "var(--accent)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
            <Plus size={16} /> Novo Cliente
          </button>
        </div>

        {/* Filtros */}
        <div className="rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF, WhatsApp ou @Instagram"
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm outline-none transition-all"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)" }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border)" }} />
          </div>
          <div className="flex gap-1.5">
            {["ativos", "inativos", "todos"].map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all"
                style={{
                  background: status === s ? "var(--accent)" : "transparent",
                  color:      status === s ? "#fff" : "var(--text-secondary)",
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div
          tabIndex={0}
          onKeyDown={tableKeyDown}
          onFocus={() => setTableFocused(true)}
          onBlur={() => { setTableFocused(false); resetSel() }}
          className="overflow-x-auto outline-none"
        >
          <table className="w-full min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Nome", "WhatsApp", "Instagram", "Status", "Notificações", "Ações"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "var(--accent)" }} />
                </td></tr>
              ) : clientes.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Nenhum cliente encontrado.
                </td></tr>
              ) : clientes.map((c, idx) => (
                <tr key={c.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border)", background: sel === idx ? "var(--accent-bg)" : "transparent", borderLeft: sel === idx ? "3px solid var(--accent)" : "3px solid transparent", outline: "none" }}
                  onMouseEnter={e => { if (sel !== idx) (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)" }}
                  onMouseLeave={e => { if (sel !== idx) (e.currentTarget as HTMLTableRowElement).style.background = "transparent" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>{c.nome}</p>
                      {(c as Cliente & { saldo_credito?: number }).saldo_credito! > 0 && (
                        <span
                          title={`Crédito disponível: R$ ${((c as Cliente & { saldo_credito?: number }).saldo_credito ?? 0).toFixed(2).replace(".", ",")}`}
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full cursor-default select-none"
                          style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
                          ✦ R$ {((c as Cliente & { saldo_credito?: number }).saldo_credito ?? 0).toFixed(2).replace(".", ",")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {c.celular ? (
                      <a href={`https://wa.me/55${c.celular.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 hover:underline"
                        style={{ color: "#25d366" }}
                        onClick={e => e.stopPropagation()}>
                        <MessageCircle size={13} />
                        {c.celular}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium uppercase" style={{ color: "var(--text-secondary)" }}>
                    {c.instagram ? `@${c.instagram.replace(/^@/, "")}` : "—"}
                  </td>

                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-xs font-semibold px-2.5 py-1 rounded-full uppercase",
                      c.ativo ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400",
                    )}>
                      {c.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <BadgeNotificacao status={c.notificacao_status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrirDrawer(c)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: "rgba(99,102,241,0.1)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.2)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.2)" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.1)" }}>
                        <Eye size={12} /> Ver
                      </button>
                      <button
                        onClick={() => toggleStatus.mutate({ id: c.id, ativo: !c.ativo })}
                        disabled={toggleLoadingId === c.id}
                        title={c.ativo ? "Desativar cliente" : "Ativar cliente"}
                        className="relative p-1.5 rounded-lg transition-all duration-200 group overflow-hidden"
                        style={{
                          color: toggleLoadingId === c.id ? (c.ativo ? "#f87171" : "#4ade80") : "var(--text-muted)",
                          background: toggleLoadingId === c.id ? (c.ativo ? "rgba(248,113,113,0.15)" : "rgba(74,222,128,0.15)") : "transparent",
                          transform: toggleLoadingId === c.id ? "scale(1.15)" : "scale(1)",
                        }}
                        onMouseEnter={e => {
                          const b = e.currentTarget
                          b.style.color = c.ativo ? "#f87171" : "#4ade80"
                          b.style.background = c.ativo ? "rgba(248,113,113,0.12)" : "rgba(74,222,128,0.12)"
                          b.style.transform = "scale(1.1)"
                        }}
                        onMouseLeave={e => {
                          const b = e.currentTarget
                          if (toggleLoadingId !== c.id) {
                            b.style.color = "var(--text-muted)"
                            b.style.background = "transparent"
                            b.style.transform = "scale(1)"
                          }
                        }}>
                        {toggleLoadingId === c.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : c.ativo ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tableFocused && (
          <div className="px-4 py-2 flex items-center gap-3 border-t" style={{ borderColor: "var(--border)" }}>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 10 }}>↑↓</kbd>
              {" "}navegar{" · "}
              <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 10 }}>Enter</kbd>
              {" "}abrir{" · "}
              <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 10 }}>Esc</kbd>
              {" "}deselecionar
            </span>
          </div>
        )}
      </div>

      {/* Wizard */}
      <AnimatePresence>
        {wizard && (
          <WizardCliente
            inicial={editForm}
            editandoId={editId}
            quickEdit={!!quickEditStep}
            initialStep={quickEditStep ?? undefined}
            onClose={() => { setWizard(false); setEditForm(null); setEditId(null); setQuickEditStep(null); setFromVendas(false) }}
            onSalvo={(savedId) => {
              setWizard(false); setEditForm(null); setEditId(null)
              if (quickEditStep) { setQuickEditStep(null); setDrawer(null) }
              if (fromVendas && savedId) {
                setFromVendas(false)
                router.push(`/vendas?cliente_id=${savedId}`)
                return
              }
              setFromVendas(false)
            }}
          />
        )}
      </AnimatePresence>

      {/* Toast ativar/inativar */}
      <AnimatePresence>
        {toggleToast && (
          <motion.div
            key="toggle-toast"
            initial={{ opacity: 0, y: 60, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="fixed bottom-6 left-1/2 z-[999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl select-none"
            style={{
              transform: "translateX(-50%)",
              background: toggleToast.ativo
                ? "linear-gradient(135deg, #16a34a, #22c55e)"
                : "linear-gradient(135deg, #dc2626, #ef4444)",
              boxShadow: toggleToast.ativo
                ? "0 8px 32px rgba(22,163,74,0.45), 0 2px 8px rgba(0,0,0,0.2)"
                : "0 8px 32px rgba(220,38,38,0.45), 0 2px 8px rgba(0,0,0,0.2)",
            }}>
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 500 }}
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.22)" }}>
              {toggleToast.ativo
                ? <UserCheck size={16} color="#fff" strokeWidth={2.5} />
                : <UserX     size={16} color="#fff" strokeWidth={2.5} />}
            </motion.div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">
                {toggleToast.ativo ? "Cliente ativado!" : "Cliente inativado!"}
              </p>
              <p className="text-[11px] text-white/70 leading-tight">
                {toggleToast.ativo ? "Status atualizado para ativo" : "Status atualizado para inativo"}
              </p>
            </div>
            {/* Barra de progresso */}
            <motion.div
              className="absolute bottom-0 left-0 h-[3px] rounded-b-2xl"
              style={{ background: "rgba(255,255,255,0.4)" }}
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 3, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawer Resumo */}
      <AnimatePresence>
        {drawer && (
          <DrawerCliente
            cliente={drawer}
            onClose={() => { setDrawer(null); setReenvioMsg(null) }}
            onEditar={() => abrirEdicao(drawer)}
            onToggleStatus={() => {
              toggleStatus.mutate({ id: drawer.id, ativo: !drawer.ativo })
              setDrawer(null)
            }}
            onReenviarNotificacao={() => reenviarNotificacao(drawer)}
            onEditarCampo={(step) => abrirEdicaoRapida(drawer, step)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ClientesPage() {
  return (
    <Suspense>
      <ClientesPageInner />
    </Suspense>
  )
}
