"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import {
  Plus, Loader2, X, ChevronLeft, ArrowRight, RefreshCw, Check, Search, ChevronRight,
  CheckCircle2, XCircle, Clock, Send, Eye, Pencil,
} from "lucide-react"
import { apiGet, apiPost, apiPatch } from "@/services/api"
import { SuccessOverlay } from "@/components/SuccessOverlay"
import { fmtData, cn } from "@/lib/utils"
import { useTableKeyNav } from "@/hooks/useKeyNav"
import { gerarReciboPDF } from "@/lib/recibo-pdf"

// ─── Tipos ────────────────────────────────────────────────
type Troca = {
  id: number; tipo: string; status: string; motivo: string
  cliente_nome?: string; cliente_id?: number; nome_produto?: string; quantidade?: number
  created_at: string; resultado_fin?: string; decisao_produto?: string
  notificacao_status?: "pendente" | "enviado" | "erro" | null
}

// ─── Badge notificação ────────────────────────────────────
function BadgeNotif({ status }: { status?: "pendente" | "enviado" | "erro" | null }) {
  if (!status) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400">—</span>
  const map = {
    pendente: { bg: "bg-amber-500/10",   text: "text-amber-400",   icon: <Clock size={9} />,         label: "Pendente" },
    enviado:  { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: <CheckCircle2 size={9} />,  label: "Enviado"  },
    erro:     { bg: "bg-red-500/10",     text: "text-red-400",     icon: <XCircle size={9} />,       label: "Erro"     },
  }
  const { bg, text, icon, label } = map[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${bg} ${text}`}>
      {icon} {label}
    </span>
  )
}

const STATUS_LABELS: Record<string, string> = {
  // Mapeamento de legado (registros antigos) — não usados em novos registros
  solicitado: "Concluído", analisando: "Concluído",
  aprovado: "Concluído", recusado: "Cancelado",
  concluido: "Concluído",
}

interface TrocaForm {
  tipo: string
  nome_produto: string
  produto_id: number | null
  cliente_nome: string
  cliente_id: number | null
  motivo: string
}

const EMPTY: TrocaForm = { tipo: "troca", nome_produto: "", produto_id: null, cliente_nome: "", cliente_id: null, motivo: "" }

type ProdComprado = { produto_id: number | null; nome: string; preco_unit: number; qtd_compras: number }

// ─── Dados de Motivos ─────────────────────────────────────
type TopicoMotivo = { topico: string; emoji: string; cor: string; motivos: string[] }

const MOTIVOS_TROCA: TopicoMotivo[] = [
  {
    topico: "Tamanho ou Ajuste", emoji: "📏", cor: "#6366f1",
    motivos: [
      "Tamanho pequeno", "Tamanho grande", "Modelagem não serviu",
      "Peça ficou apertada", "Peça ficou larga", "Comprimento inadequado",
      "Caimento não agradou", "Peça não vestiu bem", "Cliente prefere outro tamanho",
    ],
  },
  {
    topico: "Preferência da Cliente", emoji: "💜", cor: "#a855f7",
    motivos: [
      "Cliente não gostou da peça", "Cliente mudou de ideia", "Cliente prefere outro modelo",
      "Cliente prefere outra cor", "Cliente prefere outra estampa", "Peça não combinou com a cliente",
      "Peça não atendeu à expectativa", "Cliente comprou por engano",
      "Cliente deseja trocar por outro produto",
    ],
  },
  {
    topico: "Condição do Produto", emoji: "🔎", cor: "#f59e0b",
    motivos: [
      "Produto com defeito", "Produto com avaria", "Produto com mancha",
      "Produto com rasgo", "Produto com furo", "Costura solta",
      "Peça descosturada", "Zíper com problema", "Botão faltando",
      "Botão danificado", "Elástico danificado", "Fecho com problema",
      "Peça com odor", "Peça com desgaste não identificado antes da venda",
    ],
  },
  {
    topico: "Erro Operacional", emoji: "⚠️", cor: "#ef4444",
    motivos: [
      "Produto separado errado", "Produto entregue errado", "Produto enviado errado",
      "Cor separada incorretamente", "Tamanho separado incorretamente",
      "Peça trocada entre sacolas", "Peça trocada entre pedidos",
      "Pedido entregue incompleto", "Divergência entre produto anunciado e produto entregue",
    ],
  },
  {
    topico: "Live", emoji: "📱", cor: "#ec4899",
    motivos: [
      "Peça não correspondeu à expectativa da live", "Cliente não visualizou detalhe informado na live",
      "Cliente não percebeu detalhe da peça", "Cliente comprou por engano na live",
      "Cliente desistiu após reserva", "Cliente solicitou troca antes da retirada",
      "Cliente confundiu a peça durante a live", "Cliente escolheu a peça errada na live",
    ],
  },
]

const MOTIVOS_DEVOLUCAO: TopicoMotivo[] = [
  {
    topico: "Desistência", emoji: "↩️", cor: "#6366f1",
    motivos: [
      "Cliente desistiu da compra", "Arrependimento da compra",
      "Cliente mudou de ideia", "Cliente não deseja mais o produto",
      "Compra realizada por engano", "Cliente comprou item duplicado",
      "Cliente encontrou outra opção", "Cliente solicitou cancelamento da compra",
    ],
  },
  {
    topico: "Problema no Produto", emoji: "🔎", cor: "#f59e0b",
    motivos: [
      "Produto com defeito", "Produto com avaria", "Produto danificado",
      "Produto com mancha", "Produto com rasgo", "Produto com furo",
      "Produto incompleto", "Produto diferente do anunciado",
      "Produto em condição diferente da informada", "Produto não atendeu à expectativa da cliente",
    ],
  },
  {
    topico: "Problema no Pedido", emoji: "📦", cor: "#ef4444",
    motivos: [
      "Produto errado entregue", "Pedido incorreto", "Pedido incompleto",
      "Produto não recebido", "Extravio na entrega", "Atraso na entrega",
      "Entrega realizada no endereço incorreto", "Cliente não recebeu todos os itens",
    ],
  },
  {
    topico: "Pagamento ou Financeiro", emoji: "💳", cor: "#10b981",
    motivos: [
      "Pagamento duplicado", "Cobrança indevida", "Valor cobrado incorretamente",
      "Cancelamento por falta de pagamento", "Cancelamento solicitado antes do envio",
      "Cancelamento solicitado antes da retirada", "Cliente solicitou estorno",
      "Cliente solicitou crédito na loja",
    ],
  },
  {
    topico: "Logística ou Retirada", emoji: "🚚", cor: "#0ea5e9",
    motivos: [
      "Cliente não retirou no prazo", "Cliente não conseguiu retirar",
      "Cliente solicitou cancelamento antes da retirada", "Cliente ausente na entrega",
      "Endereço informado incorretamente", "Produto retornou para a loja",
      "Cliente não informou dados para entrega", "Cliente não respondeu sobre a retirada",
    ],
  },
  {
    topico: "Administrativo", emoji: "🗂️", cor: "#8b5cf6",
    motivos: [
      "Ajuste interno de estoque", "Correção de lançamento", "Cancelamento administrativo",
      "Lançamento feito em duplicidade", "Produto cadastrado incorretamente",
      "Venda registrada incorretamente", "Troca autorizada pela gerência",
      "Devolução autorizada pela gerência", "Tratativa excepcional com cliente",
      "Motivo não informado pela cliente",
    ],
  },
]

// ─── Seletor de Motivo ────────────────────────────────────
function SeletorMotivo({
  tipo, valor, onChange,
}: {
  tipo: string
  valor: string
  onChange: (v: string) => void
}) {
  const [fase, setFase] = useState<"topicos" | "motivos" | "outros">("topicos")
  const [topicoSel, setTopicoSel] = useState<TopicoMotivo | null>(null)
  const [outrosTexto, setOutrosTexto] = useState("")
  const [faseDir, setFaseDir] = useState(1)
  const outrosRef = useRef<HTMLTextAreaElement>(null)

  const lista = tipo === "troca" ? MOTIVOS_TROCA : MOTIVOS_DEVOLUCAO

  // Inicializa a fase se já há valor
  useEffect(() => {
    if (!valor) { setFase("topicos"); setTopicoSel(null); return }
    // Verifica se é um motivo de lista
    for (const t of lista) {
      if (t.motivos.some(m => m.toUpperCase() === valor)) {
        setTopicoSel(t); setFase("motivos"); return
      }
    }
    // Senão é "outros"
    setOutrosTexto(valor); setFase("outros")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (fase === "outros") setTimeout(() => outrosRef.current?.focus(), 100)
  }, [fase])

  function irParaMotivos(t: TopicoMotivo) {
    setFaseDir(1); setTopicoSel(t)
    setTimeout(() => setFase("motivos"), 10)
  }

  function voltar() {
    setFaseDir(-1)
    if (fase === "motivos" || fase === "outros") {
      setTimeout(() => { setFase("topicos"); setTopicoSel(null) }, 10)
      onChange("")
    }
  }

  const fvariants = {
    enter:  (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  }

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
        <button onClick={() => { if (fase !== "topicos") voltar() }}
          className={cn("font-semibold transition-colors uppercase", fase !== "topicos" ? "hover:underline cursor-pointer" : "")}
          style={{ color: fase === "topicos" ? "var(--text-primary)" : "var(--accent)" }}>
          {tipo === "troca" ? "Motivo da Troca" : "Motivo da Devolução"}
        </button>
        {topicoSel && <>
          <ChevronRight size={12} />
          <span className="uppercase" style={{ color: fase === "motivos" || fase === "outros" ? "var(--text-primary)" : "var(--text-muted)" }}>
            {topicoSel.topico}
          </span>
        </>}
        {fase === "outros" && <>
          <ChevronRight size={12} />
          <span className="uppercase" style={{ color: "var(--text-primary)" }}>Outros</span>
        </>}
      </div>

      <AnimatePresence custom={faseDir} mode="wait">

        {/* Fase 1: Tópicos */}
        {fase === "topicos" && (
          <motion.div key="topicos" custom={faseDir} variants={fvariants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.18, ease: "easeInOut" }}>
            <div className="grid grid-cols-2 gap-2">
              {lista.map((t, i) => (
                <motion.button key={t.topico}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => irParaMotivos(t)}
                  className="flex items-center gap-2.5 p-3 rounded-xl text-left transition-all border-2 group"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}>
                  <span className="text-xl shrink-0">{t.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold leading-tight uppercase" style={{ color: "var(--text-primary)" }}>{t.topico}</p>
                    <p className="text-[9px] mt-0.5 uppercase" style={{ color: "var(--text-muted)" }}>{t.motivos.length} motivos</p>
                  </div>
                  <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Fase 2: Motivos do tópico */}
        {fase === "motivos" && topicoSel && (
          <motion.div key="motivos" custom={faseDir} variants={fvariants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.18, ease: "easeInOut" }}>
            <div className="grid grid-cols-3 gap-1.5">
              {topicoSel.motivos.map((m, i) => {
                const ativo = valor === m.toUpperCase()
                return (
                  <motion.button key={m}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.018 }}
                    onClick={() => onChange(m.toUpperCase())}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-2.5 py-2 rounded-xl text-[11px] font-semibold border-2 transition-all uppercase tracking-wide text-center leading-tight"
                    style={{
                      background: ativo ? topicoSel.cor : "var(--bg-surface)",
                      borderColor: ativo ? topicoSel.cor : "var(--border)",
                      color: ativo ? "#fff" : "var(--text-primary)",
                    }}>
                    {ativo && <Check size={10} className="inline mr-1 mb-0.5" />}
                    {m}
                  </motion.button>
                )
              })}
              {/* Outros */}
              <motion.button
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: topicoSel.motivos.length * 0.018 }}
                onClick={() => { setFaseDir(1); setFase("outros"); onChange("") }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-2.5 py-2 rounded-xl text-[11px] font-semibold border-2 border-dashed transition-all uppercase tracking-wide text-center"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                + OUTROS
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Fase 3: Outros (campo livre) */}
        {fase === "outros" && (
          <motion.div key="outros" custom={faseDir} variants={fvariants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.18, ease: "easeInOut" }}>
            <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
              Descreva o motivo específico:
            </p>
            <textarea
              ref={outrosRef}
              value={outrosTexto}
              onChange={e => { setOutrosTexto(e.target.value); onChange(e.target.value) }}
              placeholder="Ex: cliente solicitou troca para presente..."
              rows={4}
              className="w-full px-5 py-4 text-base rounded-2xl outline-none transition-all border-2 resize-none focus:border-[color:var(--accent)] leading-relaxed"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão voltar interno */}
      {fase !== "topicos" && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={voltar}
          className="flex items-center gap-1 text-[11px] font-medium mt-2 transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
          <ChevronLeft size={11} /> Voltar para tópicos
        </motion.button>
      )}
    </div>
  )
}

// ─── Animação wizard ──────────────────────────────────────
const variants = {
  enter:  (d: number) => ({ x: d > 0 ?  60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: d > 0 ? -60 :  60, opacity: 0 }),
}

// ─── Modal de produtos comprados ──────────────────────────
function ModalProdutosCliente({
  clienteId, clienteNome, onSelect, onClose, cor,
}: {
  clienteId: number; clienteNome: string
  onSelect: (p: ProdComprado) => void
  onClose: () => void
  cor: string
}) {
  const [busca, setBusca] = useState("")
  const [todos, setTodos] = useState<ProdComprado[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiGet<{ data: ProdComprado[] }>(`/clientes/${clienteId}/produtos-comprados`)
      .then(r => setTodos(r.data ?? []))
      .catch(() => setTodos([]))
      .finally(() => setLoading(false))
  }, [clienteId])

  const filtrados = busca.trim()
    ? todos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()))
    : todos

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Compras do cliente</p>
            <p className="font-bold text-sm mt-0.5 uppercase" style={{ color: "var(--text-primary)" }}>{clienteNome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Filtrar produtos..." autoFocus
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: "360px" }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={22} className="animate-spin" style={{ color: cor }} />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {todos.length === 0 ? "Nenhuma compra encontrada para este cliente." : "Nenhum produto encontrado."}
              </p>
            </div>
          ) : filtrados.map((p, idx) => (
            <button key={idx} onClick={() => { onSelect(p); onClose() }}
              className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors"
              style={{ borderBottom: "1px solid var(--border)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
              <div>
                <p className="text-sm font-semibold uppercase" style={{ color: "var(--text-primary)" }}>{p.nome}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {p.qtd_compras}× comprado{p.qtd_compras > 1 ? "s" : ""}
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${cor}22`, color: cor }}>
                Selecionar
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Wizard ───────────────────────────────────────────────
function WizardTroca({ onClose, onSalvo }: { onClose: () => void; onSalvo: () => void }) {
  const qc = useQueryClient()
  const [step, setStep]   = useState(1)
  const [dir, setDir]     = useState(1)
  const [form, setForm]   = useState<TrocaForm>(EMPTY)
  const [erro, setErro]   = useState("")
  const [saving, setSaving] = useState(false)
  const [salvoOk, setSalvoOk] = useState(false)
  const [modalProd, setModalProd] = useState(false)
  const [valorProduto, setValorProduto] = useState("")
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const TOTAL = 6

  // ── Autocomplete Cliente (step 2) ──────────────────────
  const [cliBusca, setCliBusca]   = useState("")
  const [cliRes, setCliRes]       = useState<{ id: number; nome: string }[]>([])
  const [cliOpen, setCliOpen]     = useState(false)
  const [cliLoading, setCliLoading] = useState(false)
  const [cliIdx, setCliIdx]       = useState(-1)

  useEffect(() => {
    if (step !== 2) return
    if (!cliBusca.trim()) { setCliRes([]); return }
    const t = setTimeout(async () => {
      setCliLoading(true)
      try {
        const r = await apiGet<{ data: { id: number; nome: string }[] }>(`/clientes?busca=${encodeURIComponent(cliBusca)}&limit=8`)
        setCliRes(r.data ?? [])
        setCliIdx(-1)
        setCliOpen(true)
      } catch { setCliRes([]) }
      finally { setCliLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [cliBusca, step])

  // ── Autocomplete Produto (step 3) ──────────────────────
  const [prodBusca, setProdBusca]   = useState("")
  const [prodRes, setProdRes]       = useState<ProdComprado[]>([])
  const [prodOpen, setProdOpen]     = useState(false)
  const [prodLoading, setProdLoading] = useState(false)

  useEffect(() => {
    if (step !== 3) return
    if (!prodBusca.trim()) { setProdRes([]); return }
    const t = setTimeout(async () => {
      setProdLoading(true)
      try {
        if (form.cliente_id) {
          const r = await apiGet<{ data: ProdComprado[] }>(`/clientes/${form.cliente_id}/produtos-comprados?busca=${encodeURIComponent(prodBusca)}`)
          setProdRes(r.data ?? [])
        } else {
          const r = await apiGet<{ data: { id: number; nome: string; codigo?: string }[] }>(`/produtos?busca=${encodeURIComponent(prodBusca)}&limit=8`)
          setProdRes((r.data ?? []).map(p => ({ produto_id: p.id, nome: p.nome, preco_unit: 0, qtd_compras: 0 })))
        }
        setProdOpen(true)
      } catch { setProdRes([]) }
      finally { setProdLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [prodBusca, step, form.cliente_id])

  useEffect(() => {
    if (step !== 4 && step !== 5) {
      const t = setTimeout(() => inputRef.current?.focus(), 280)
      return () => clearTimeout(t)
    }
  }, [step])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  function set<K extends keyof TrocaForm>(k: K, v: TrocaForm[K]) { setForm(f => ({ ...f, [k]: v })); setErro("") }
  function go(next: number) { setDir(next > step ? 1 : -1); setStep(next); setErro("") }

  function advance() {
    if (step === 4 && !form.motivo.trim()) { setErro("Selecione um motivo para continuar"); return }
    if (step < TOTAL) go(step + 1)
  }

  async function handleSalvar() {
    setSaving(true); setErro("")
    try {
      const res = await apiPost<{ id: number; credito_gerado?: number }>("/trocas", {
        tipo: form.tipo,
        nome_produto: form.nome_produto || null,
        produto_id: form.produto_id || null,
        cliente_nome: form.cliente_nome || null,
        cliente_id: form.cliente_id || null,
        motivo: form.motivo.trim(),
        valor_produto: valorProduto ? parseFloat(valorProduto.replace(",", ".")) : null,
        // Já salva como concluído — sem necessidade de aprovação (regra 1 e 2)
        status: "concluido",
      })
      qc.invalidateQueries({ queryKey: ["trocas"] })

      // ── Envio automático do recibo (regra 5) ──────────────
      if (res.id && form.cliente_id) {
        try {
          const tipoRecibo = form.tipo === "devolucao" ? "Devolução" : "Troca"
          const pdfBlob = await gerarReciboPDF({
            numero: res.id,
            tipo: tipoRecibo as "Troca" | "Devolução",
            data: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            cliente_nome: form.cliente_nome || "Cliente",
            cliente_celular: "",
            itens: form.nome_produto ? [{
              nome: form.nome_produto,
              qtd: 1,
              preco_unit: 0,
              subtotal: 0,
            }] : [],
            forma_pagamento: "—",
            total: 0,
          })
          const arrayBuffer = await pdfBlob.arrayBuffer()
          const uint8 = new Uint8Array(arrayBuffer)
          let binary = ""
          for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i])
          const base64 = btoa(binary)
          apiPost("/trocas/recibo", { trocaId: res.id, pdfBase64: base64, reenviar: false }).catch(() => {})
        } catch { /* Falha no PDF não cancela o registro */ }
      }

      setSalvoOk(true)
      setTimeout(() => { setSalvoOk(false); onSalvo() }, 2200)
    } catch (err) {
      setErro((err as Error).message || "Erro ao salvar. Tente novamente.")
    }
    finally { setSaving(false) }
  }

  const TIPOS = ["troca", "devolucao"]

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (step === 1) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault()
        const cur = TIPOS.indexOf(form.tipo)
        set("tipo", TIPOS[(cur + 1) % TIPOS.length])
      } else if (e.key === "Enter") {
        e.preventDefault(); go(2)
      }
      return
    }
    if (step === 2 && cliOpen && cliRes.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setCliIdx(i => Math.min(i + 1, cliRes.length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setCliIdx(i => Math.max(i - 1, -1))
        return
      }
      if (e.key === "Enter" && cliIdx >= 0) {
        e.preventDefault()
        const c = cliRes[cliIdx]
        set("cliente_nome", c.nome); set("cliente_id", c.id)
        setCliBusca(""); setCliOpen(false); setCliIdx(-1)
        return
      }
    }
    if (e.key === "Enter" && step < TOTAL && step !== 4 && step !== 5) { e.preventDefault(); advance() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, cliOpen, cliRes, cliIdx])

  const iBase = "w-full px-5 py-4 text-lg rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }
  const cor = form.tipo === "troca" ? "#6366f1" : "#a855f7"

  return (
    <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>

      <SuccessOverlay show={salvoOk} titulo={form.tipo === "troca" ? "Troca registrada!" : "Devolução registrada!"} subtitulo={form.nome_produto || ""} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>Brechó Bellasu</span>
          <span style={{ color: "var(--border-hover)" }}>|</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Registrar Troca / Devolução</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>{step} / {TOTAL}</span>
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors" style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
            <X size={15} /> Cancelar
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-hidden relative" onKeyDown={handleKey}>
        <AnimatePresence custom={dir} mode="wait">
          {step < TOTAL ? (
            <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className={cn(
                "absolute inset-0 flex flex-col items-center px-6",
                step === 4 ? "justify-start pt-5 overflow-hidden" : "justify-center overflow-y-auto py-8"
              )}
              style={step === 5 ? { maxHeight: "100%" } : undefined}>
              <div className="w-full max-w-xl">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base font-bold" style={{ color: cor }}>{step}</span>
                  <ArrowRight size={14} style={{ color: cor }} />
                </div>

                {/* Step 1 — Tipo */}
                {step === 1 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Troca ou devolução?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Selecione o tipo de solicitação.</p>
                  <div className="flex gap-3">
                    {[
                      { value: "troca", label: "Troca", emoji: "🔄", desc: "Trocar por outro produto" },
                      { value: "devolucao", label: "Devolução", emoji: "↩️", desc: "Devolver e reembolsar" },
                    ].map(op => (
                      <motion.button key={op.value} onClick={() => { set("tipo", op.value); go(2) }}
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        className="flex-1 p-5 rounded-2xl text-left transition-all border-2"
                        style={{
                          background: form.tipo === op.value ? "var(--accent-bg)" : "var(--bg-surface)",
                          borderColor: form.tipo === op.value ? "var(--accent)" : "var(--border)",
                          color: "var(--text-primary)",
                        }}>
                        <div className="text-3xl mb-2">{op.emoji}</div>
                        <p className="font-bold uppercase">{op.label}</p>
                        <p className="text-sm mt-1 uppercase" style={{ color: "var(--text-muted)" }}>{op.desc}</p>
                      </motion.button>
                    ))}
                  </div>
                </>}

                {/* Step 2 — Cliente */}
                {step === 2 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Nome do cliente?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Busque pelo nome cadastrado. O produto será filtrado pelas compras dele.</p>
                  <div className="relative">
                    <input ref={inputRef as React.RefObject<HTMLInputElement>}
                      value={cliBusca !== "" ? cliBusca : form.cliente_nome}
                      onChange={e => {
                        setCliBusca(e.target.value); set("cliente_nome", e.target.value)
                        if (form.cliente_id) set("cliente_id", null)
                      }}
                      onFocus={() => { if (cliRes.length) setCliOpen(true) }}
                      onBlur={() => setTimeout(() => setCliOpen(false), 150)}
                      placeholder="Digite o nome do cliente..."
                      className={iBase} style={iSt} autoComplete="off" />
                    {cliLoading && <Loader2 size={16} className="animate-spin absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />}
                    {form.cliente_id && !cliLoading && <Check size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400" />}
                    {cliOpen && cliRes.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl overflow-hidden z-20 shadow-xl"
                        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                        {cliRes.map((c, idx) => (
                          <button key={c.id} type="button"
                            onMouseDown={() => { set("cliente_nome", c.nome); set("cliente_id", c.id); setCliBusca(""); setCliOpen(false); setCliIdx(-1) }}
                            onMouseEnter={() => setCliIdx(idx)}
                            onMouseLeave={() => setCliIdx(-1)}
                            className="w-full text-left px-4 py-3 text-sm font-medium uppercase transition-colors"
                            style={{ color: "var(--text-primary)", background: cliIdx === idx ? "var(--bg-hover)" : "transparent" }}>
                            {c.nome}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {form.cliente_id && (
                    <div className="mt-3 px-4 py-3 rounded-2xl flex items-center gap-3"
                      style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.4)" }}>
                      <Check size={15} style={{ color: "#10b981" }} />
                      <p className="text-sm font-bold uppercase" style={{ color: "#10b981" }}>{form.cliente_nome}</p>
                    </div>
                  )}
                </>}

                {/* Step 3 — Produto */}
                {step === 3 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Qual produto?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                    {form.cliente_id
                      ? <>Produtos comprados por <strong style={{ color: "var(--text-secondary)" }}>{form.cliente_nome}</strong>.</>
                      : "Busque pelo nome do produto cadastrado."}
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input ref={inputRef as React.RefObject<HTMLInputElement>}
                        value={prodBusca !== "" ? prodBusca : form.nome_produto}
                        onChange={e => { setProdBusca(e.target.value); set("nome_produto", e.target.value) }}
                        onFocus={() => { if (prodRes.length) setProdOpen(true) }}
                        onBlur={() => setTimeout(() => setProdOpen(false), 150)}
                        placeholder="Digite para buscar..."
                        className={iBase} style={iSt} autoComplete="off" />
                      {prodLoading && <Loader2 size={16} className="animate-spin absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />}
                      {prodOpen && prodRes.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl overflow-hidden z-20 shadow-xl"
                          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                          {prodRes.map((p, idx) => (
                            <button key={idx} type="button"
                              onMouseDown={() => { set("nome_produto", p.nome); set("produto_id", p.produto_id); setProdBusca(""); setProdOpen(false) }}
                              className="w-full text-left px-4 py-3 text-sm font-medium uppercase transition-colors flex items-center justify-between"
                              style={{ color: "var(--text-primary)" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                              <span>{p.nome}</span>
                              {p.qtd_compras > 0 && <span className="text-xs font-mono ml-2 shrink-0" style={{ color: "var(--text-muted)" }}>{p.qtd_compras}× comprado</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {form.cliente_id && (
                      <button onClick={() => setModalProd(true)}
                        className="flex items-center justify-center w-14 h-[58px] rounded-2xl border-2 transition-all shrink-0"
                        style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: cor }}
                        title="Ver todos os produtos comprados pelo cliente"
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = cor }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)" }}>
                        <Search size={20} />
                      </button>
                    )}
                  </div>
                  {form.cliente_id && (
                    <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                      🔍 Toque na lupa para ver todos os produtos comprados por este cliente.
                    </p>
                  )}
                </>}

                {/* Step 4 — Motivo (seletor inteligente) */}
                {step === 4 && <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Qual o motivo?</h1>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Escolha o tópico e depois o motivo específico.</p>
                    </div>
                    {form.motivo && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold max-w-[200px]"
                        style={{ background: `${cor}18`, border: `1px solid ${cor}40`, color: cor }}>
                        <Check size={11} />
                        <span className="truncate">{form.motivo}</span>
                      </motion.div>
                    )}
                  </div>
                  <SeletorMotivo tipo={form.tipo} valor={form.motivo} onChange={v => set("motivo", v)} />
                </>}

                {/* Step 5 — Valor & Crédito */}
                {step === 5 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Valor do produto</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                    Informe o valor pago pela cliente. Esse valor será gerado como crédito para uso em próximas compras.
                  </p>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-bold select-none" style={{ color: "var(--text-muted)" }}>R$</span>
                    <input
                      value={valorProduto}
                      onChange={e => { setValorProduto(e.target.value); setErro("") }}
                      placeholder="0,00"
                      inputMode="decimal"
                      disabled={!form.cliente_id}
                      className={`${iBase} pl-12 disabled:opacity-50 disabled:cursor-not-allowed`}
                      style={iSt} />
                  </div>
                  {!form.cliente_id && (
                    <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                      ℹ️ Selecione uma cliente (step 2) para gerar crédito.
                    </p>
                  )}
                  {form.cliente_id && valorProduto && parseFloat(valorProduto.replace(",", ".")) > 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-4 px-5 py-4 rounded-2xl flex items-center justify-between"
                      style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.35)" }}>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#10b981" }}>Crédito a gerar</p>
                        <p className="text-2xl font-bold mt-0.5" style={{ color: "#10b981" }}>
                          R$ {parseFloat(valorProduto.replace(",", ".")).toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                      <span className="text-2xl">✦</span>
                    </motion.div>
                  )}
                  <p className="text-xs mt-4 opacity-60" style={{ color: "var(--text-muted)" }}>
                    Deixe em branco para não gerar crédito agora.
                  </p>
                </>}

                <AnimatePresence>
                  {erro && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-3 text-sm" style={{ color: "#f87171" }}>{erro}</motion.p>}
                </AnimatePresence>

                {step > 1 && (
                  <div className="flex items-center gap-4 mt-8">
                    <motion.button onClick={advance} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg"
                      style={{ background: "var(--accent)" }}>
                      Continuar <ArrowRight size={15} />
                    </motion.button>
                    <button onClick={() => go(step + 1)}
                      className="text-sm font-medium transition-colors" style={{ color: "var(--text-muted)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                      Pular →
                    </button>
                  </div>
                )}
              </div>
            </motion.div>

          ) : (
            /* Revisão */
            <motion.div key="revisao" custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="absolute inset-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
              {/* Sidebar */}
              <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col items-center justify-between py-4 md:py-10 px-5 md:px-6 gap-4 md:gap-0"
                style={{ background: cor }}>
                <div className="flex flex-row md:flex-col items-center gap-4 md:text-center">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                      <RefreshCw size={22} color="#fff" className="md:hidden" />
                      <RefreshCw size={32} color="#fff" className="hidden md:block" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center bg-white/90">
                      <Check size={10} style={{ color: cor }} className="md:hidden" />
                      <Check size={14} style={{ color: cor }} className="hidden md:block" />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-sm md:text-lg leading-tight text-white uppercase">{form.tipo === "devolucao" ? "Devolução" : "Troca"}</p>
                    <p className="text-xs md:text-sm text-white/80 mt-0.5 uppercase">{form.nome_produto || "—"}</p>
                    <p className="text-xs mt-1 hidden md:block" style={{ color: "rgba(255,255,255,0.6)" }}>Revise antes de salvar</p>
                  </div>
                </div>
                <div className="flex flex-row md:flex-col gap-2 md:w-full shrink-0">
                  <button onClick={handleSalvar} disabled={saving}
                    className="py-2.5 md:py-3 px-4 md:px-0 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 md:w-full"
                    style={{ background: "#fff", color: cor }}>
                    {saving ? <><Loader2 size={15} className="animate-spin" />Salvando...</> : "Registrar"}
                  </button>
                  <button onClick={onClose} className="py-2.5 px-4 md:px-0 rounded-2xl text-sm font-medium md:w-full"
                    style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}>
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Painel */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-10" style={{ background: "var(--bg-base)" }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-6" style={{ color: "var(--text-muted)" }}>◎ Dados da Solicitação</h2>
                {erro && <p className="mb-4 text-sm px-4 py-2 rounded-xl" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>{erro}</p>}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Tipo",    value: form.tipo === "troca" ? "Troca 🔄" : "Devolução ↩️", s: 1 },
                    { label: "Cliente", value: form.cliente_nome || "—", s: 2 },
                    { label: "Produto", value: form.nome_produto || "—", s: 3 },
                    { label: "Motivo",  value: form.motivo || "—", s: 4, full: true },
                    {
                      label: "Crédito a gerar",
                      value: (valorProduto && parseFloat(valorProduto.replace(",", ".")) > 0)
                        ? `✦ R$ ${parseFloat(valorProduto.replace(",", ".")).toFixed(2).replace(".", ",")}`
                        : "Sem crédito",
                      s: 5, full: false,
                    },
                  ].map(({ label, value, s, full }) => (
                    <div key={label} className={cn("rounded-2xl p-4", full ? "col-span-2" : "")}
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${cor}` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>{value}</p>
                      <button onClick={() => go(s)} className="flex items-center gap-1 text-xs mt-1.5 transition-opacity"
                        style={{ color: cor }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.65" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                        ✎ EDITAR
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {step < TOTAL && step > 1 && (
        <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => go(step - 1)}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)" }}>
            <ChevronLeft size={15} /> Voltar
          </button>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Pressione <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Enter</kbd> para avançar
          </p>
        </div>
      )}
    </motion.div>

    {/* Modal produtos comprados */}
    <AnimatePresence>
      {modalProd && form.cliente_id && (
        <ModalProdutosCliente
          clienteId={form.cliente_id} clienteNome={form.cliente_nome} cor={cor}
          onSelect={p => { set("nome_produto", p.nome); set("produto_id", p.produto_id) }}
          onClose={() => setModalProd(false)}
        />
      )}
    </AnimatePresence>
    </>
  )
}

// ─── Drawer de Visualização ───────────────────────────────
function DrawerVerTroca({
  troca,
  onClose,
  onEnviou,
}: {
  troca: Troca
  onClose: () => void
  onEnviou: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [notifMsg, setNotifMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  const cor = troca.tipo === "troca" ? "#6366f1" : "#a855f7"

  async function enviarRecibo() {
    setEnviando(true); setNotifMsg(null)
    try {
      const tipoRecibo = troca.tipo === "devolucao" ? "Devolução" : "Troca"
      const pdfBlob = await gerarReciboPDF({
        numero: troca.id,
        tipo: tipoRecibo as "Troca" | "Devolução",
        data: fmtData(troca.created_at),
        cliente_nome: troca.cliente_nome || "Cliente",
        cliente_celular: "",
        itens: troca.nome_produto ? [{ nome: troca.nome_produto, qtd: 1, preco_unit: 0, subtotal: 0 }] : [],
        forma_pagamento: "—",
        total: 0,
      })
      const arrayBuffer = await pdfBlob.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)
      let binary = ""
      for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i])
      const base64 = btoa(binary)
      await apiPost("/trocas/recibo", { trocaId: troca.id, pdfBase64: base64, reenviar: troca.notificacao_status === "enviado" })
      setNotifMsg({ ok: true, texto: "✅ Recibo enviado com sucesso!" })
      onEnviou()
    } catch (e: unknown) {
      setNotifMsg({ ok: false, texto: (e as Error).message || "Erro ao enviar." })
    } finally { setEnviando(false) }
  }

  const statusColor: Record<string, string> = {
    concluido: "#10b981", recusado: "#f87171",
    solicitado: "#10b981", analisando: "#10b981", aprovado: "#10b981",
  }

  const campos = [
    { label: "Tipo",     value: troca.tipo === "troca" ? "Troca 🔄" : "Devolução ↩️" },
    { label: "Cliente",  value: troca.cliente_nome ?? "—" },
    { label: "Produto",  value: troca.nome_produto ?? "—" },
    { label: "Motivo",   value: troca.motivo ?? "—", full: true },
    { label: "Status",   value: STATUS_LABELS[troca.status] ?? troca.status },
    { label: "Data",     value: fmtData(troca.created_at) },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="w-full max-w-md h-full flex flex-col shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-base)", borderLeft: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${cor}22` }}>
              <RefreshCw size={15} style={{ color: cor }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                {troca.tipo === "troca" ? "Troca" : "Devolução"} #{troca.id}
              </p>
              <p className="text-sm font-bold uppercase" style={{ color: "var(--text-primary)" }}>
                {troca.nome_produto || "—"}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Campos */}
          <div className="grid grid-cols-2 gap-3">
            {campos.map(({ label, value, full }) => (
              <div key={label}
                className={cn("rounded-2xl p-4", full ? "col-span-2" : "")}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${cor}` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Status da notificação */}
          <div className="rounded-2xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Recibo / Notificação</p>
            <BadgeNotif status={troca.notificacao_status} />
            {troca.notificacao_status === "enviado" && (
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Recibo enviado via WhatsApp.</p>
            )}
            {troca.notificacao_status === "erro" && (
              <p className="text-xs mt-2" style={{ color: "#f87171" }}>Houve um erro no envio anterior. Reenvie abaixo.</p>
            )}
          </div>

          {/* Feedback envio */}
          <AnimatePresence>
            {notifMsg && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="px-4 py-3 rounded-2xl text-sm font-medium"
                style={{
                  background: notifMsg.ok ? "rgba(16,185,129,0.1)" : "rgba(248,113,113,0.1)",
                  color: notifMsg.ok ? "#10b981" : "#f87171",
                  border: `1px solid ${notifMsg.ok ? "rgba(16,185,129,0.3)" : "rgba(248,113,113,0.3)"}`,
                }}>
                {notifMsg.texto}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer — botão enviar */}
        <div className="shrink-0 px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          {troca.cliente_nome ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={enviarRecibo}
              disabled={enviando}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#25d366" }}>
              {enviando
                ? <><Loader2 size={15} className="animate-spin" /> Enviando...</>
                : <><Send size={15} /> {troca.notificacao_status === "enviado" ? "Reenviar recibo" : "Enviar recibo"}</>}
            </motion.button>
          ) : (
            <p className="text-xs text-center py-2" style={{ color: "var(--text-muted)" }}>
              Sem cliente vinculado — envio não disponível.
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Página ───────────────────────────────────────────────
export default function TrocasPage() {
  const qc = useQueryClient()
  const [wizard, setWizard] = useState(false)
  const [tipo, setTipo]     = useState("")
  const [status, setStatus] = useState("")
  const [verTroca, setVerTroca] = useState<Troca | null>(null)

  const { data, isLoading } = useQuery<{ data: Troca[]; total: number }>({
    queryKey: ["trocas", tipo, status],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: "100", ...(tipo && { tipo }), ...(status && { status }) }).toString()
      return apiGet(`/trocas?${qs}`)
    },
    staleTime: 30_000,
  })

  const trocas = data?.data ?? []

  const [tableFocused, setTableFocused] = useState(false)
  const { sel, onKeyDown: tableKeyDown, reset: resetSel } = useTableKeyNav(trocas, () => {})

  const statusColor: Record<string, string> = {
    solicitado: "bg-emerald-500/10 text-emerald-400",
    analisando: "bg-emerald-500/10 text-emerald-400",
    aprovado:   "bg-emerald-500/10 text-emerald-400",
    recusado:   "bg-red-500/10 text-red-400",
    concluido:  "bg-emerald-500/10 text-emerald-400",
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>Trocas e Devoluções</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{data?.total ?? 0} registros</p>
        </div>
        <button onClick={() => setWizard(true)}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white shadow-lg transition-opacity"
          style={{ background: "var(--accent)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
          <Plus size={16}/> Nova Troca
        </button>
      </div>

      <div className="rounded-2xl px-4 py-3 flex flex-wrap gap-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex gap-1.5">
          {["","troca","devolucao"].map(t => (
            <button key={t} onClick={() => setTipo(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all"
              style={{ background: tipo === t ? "var(--accent)" : "transparent", color: tipo === t ? "#fff" : "var(--text-secondary)" }}>
              {t || "Todos"}
            </button>
          ))}
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="ml-auto py-2 px-3 rounded-xl text-sm outline-none uppercase"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <option value="">STATUS</option>
          <option value="concluido">CONCLUÍDO</option>
          <option value="recusado">CANCELADO</option>
        </select>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div tabIndex={0} onKeyDown={tableKeyDown}
          onFocus={() => setTableFocused(true)}
          onBlur={() => { setTableFocused(false); resetSel() }}
          className="overflow-x-auto outline-none">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Tipo","Produto","Cliente","Status","Data","Notificações","Ações"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "var(--accent)" }} />
                </td></tr>
              ) : trocas.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>Nenhuma troca encontrada.</td></tr>
              ) : trocas.map((t, idx) => (
                <tr key={t.id} className="transition-colors"
                  style={{ borderBottom: "1px solid var(--border)", background: sel === idx ? "var(--accent-bg)" : "transparent", borderLeft: sel === idx ? "3px solid var(--accent)" : "3px solid transparent" }}
                  onMouseEnter={e => { if (sel !== idx) (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)" }}
                  onMouseLeave={e => { if (sel !== idx) (e.currentTarget as HTMLTableRowElement).style.background = "transparent" }}>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full capitalize",
                      t.tipo === "troca" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400")}>
                      {t.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm uppercase" style={{ color: "var(--text-primary)" }}>{t.nome_produto ?? "—"}</td>
                  <td className="px-4 py-3 text-sm uppercase" style={{ color: "var(--text-secondary)" }}>{t.cliente_nome ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", statusColor[t.status] ?? "bg-slate-500/15 text-slate-400")}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>{fmtData(t.created_at)}</td>
                  <td className="px-4 py-3">
                    <BadgeNotif status={t.notificacao_status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setVerTroca(t)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                        style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.8" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                        <Eye size={12} /> Ver
                      </button>
                      <button
                        title="Editar"
                        className="p-1.5 rounded-xl transition-colors"
                        style={{ color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                        <Pencil size={12} />
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
              <kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 10 }}>Esc</kbd>
              {" "}deselecionar
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {wizard && <WizardTroca onClose={() => setWizard(false)} onSalvo={() => setWizard(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {verTroca && (
          <DrawerVerTroca
            troca={verTroca}
            onClose={() => setVerTroca(null)}
            onEnviou={() => {
              qc.invalidateQueries({ queryKey: ["trocas"] })
              // Atualiza o objeto local para refletir status enviado
              setVerTroca(prev => prev ? { ...prev, notificacao_status: "enviado" } : null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
