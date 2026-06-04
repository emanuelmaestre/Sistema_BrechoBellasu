"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import {
  Package, Plus, X, Loader2, Search, Truck, CheckCircle2,
  AlertCircle, ExternalLink, Tag, RefreshCw, MapPin, User,
  Box, Weight, Ruler, Printer, Clock, BadgeCheck,
  ShoppingBag, Zap, Star, Info, ArrowRight, ChevronLeft, Check, Download,
  Wallet2, QrCode, Copy,
} from "lucide-react"
import { apiGet, apiPost, apiDelete } from "@/services/api"
import { SuccessOverlay } from "@/components/SuccessOverlay"
import { fmtBRL, cn } from "@/lib/utils"
import { useDropdownKeyNav } from "@/hooks/useKeyNav"

// ── Tipos ─────────────────────────────────────────────────
interface Cliente {
  id: number; nome: string; cpf_cnpj?: string | null
  celular?: string | null; cep?: string | null; logradouro?: string | null
  numero?: string | null; complemento?: string | null; bairro?: string | null
  cidade?: string | null; estado?: string | null
  // Endereço de entrega alternativo (opcional)
  entrega_cep?: string | null; entrega_logradouro?: string | null
  entrega_numero?: string | null; entrega_complemento?: string | null
  entrega_bairro?: string | null; entrega_cidade?: string | null
  entrega_estado?: string | null
}

// Endereço genérico (cadastro ou entrega) para preencher o form
interface Endereco {
  cep?: string | null; logradouro?: string | null; numero?: string | null
  complemento?: string | null; bairro?: string | null
  cidade?: string | null; estado?: string | null
}

interface Servico {
  id: number; name: string; price: string; currency: string
  delivery_time: number; delivery_range: { min: number; max: number }
  company: { name: string; picture: string }
  discount?: { percentage: number }
  custom_price?: string
}

interface MEOrder {
  id: string; protocol: string; status: string
  tracking: string | null; label_url?: string
  created_at: string; price?: string
  to?: { name: string; postal_code: string; city: string; state_abbr: string }
  company?: { name: string; picture: string }
  delivery_range?: { min: number; max: number }
}

interface StatusInfo {
  configurado: boolean; env: string; mensagem?: string
  usuario?: { nome: string; email: string }; cep_origem?: string
}

interface ShipForm {
  nome: string; cpf: string; telefone: string
  cep: string; logradouro: string; numero: string
  complemento: string; bairro: string; cidade: string; estado: string
  peso: string; altura: string; largura: string; comprimento: string
  valor_declarado: string; venda_id: string
}

const EMPTY_FORM: ShipForm = {
  nome: "", cpf: "", telefone: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
  peso: "0.5", altura: "5", largura: "20", comprimento: "30",
  valor_declarado: "", venda_id: "",
}

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:      { label: "Aguardando",  bg: "bg-amber-600/10",   text: "text-amber-400",   dot: "bg-amber-400" },
  released:     { label: "Liberada",    bg: "bg-blue-600/10",    text: "text-blue-400",    dot: "bg-blue-400" },
  generated:    { label: "Gerada",      bg: "bg-purple-600/10",  text: "text-purple-400",  dot: "bg-purple-400" },
  posted:       { label: "Postada",     bg: "bg-indigo-600/10",  text: "text-indigo-400",  dot: "bg-indigo-400" },
  delivered:    { label: "Entregue",    bg: "bg-emerald-600/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  canceled:     { label: "Cancelada",   bg: "bg-red-600/10",     text: "text-red-400",     dot: "bg-red-400" },
  "in transit": { label: "Em trânsito", bg: "bg-cyan-600/10",    text: "text-cyan-400",    dot: "bg-cyan-400" },
}

const TRANSPORTADORA_COLORS: Record<string, string> = {
  "Correios": "from-amber-600/20 to-amber-700/10 border-amber-600/20",
  "Jadlog":   "from-red-600/20 to-red-700/10 border-red-600/20",
  "JadLog":   "from-red-600/20 to-red-700/10 border-red-600/20",
  "Latam":    "from-sky-600/20 to-sky-700/10 border-sky-600/20",
  "Azul":     "from-blue-600/20 to-blue-700/10 border-blue-600/20",
  "Total":    "from-violet-600/20 to-violet-700/10 border-violet-600/20",
  "default":  "from-slate-700/30 to-slate-800/20 border-white/10",
}

function carrierGradient(name: string) {
  for (const [k, v] of Object.entries(TRANSPORTADORA_COLORS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return v
  }
  return TRANSPORTADORA_COLORS.default
}

const COR = "#6366f1"

// ── Ilustração 3D da caixa ────────────────────────────────────
function BoxDiagram({ altura, largura, comprimento }: { altura: string; largura: string; comprimento: string }) {
  const ST = "#6366f1"
  const FT = "rgba(99,102,241,0.40)"
  const FL = "rgba(99,102,241,0.20)"
  const FR = "rgba(99,102,241,0.28)"
  const AR = "#818cf8"
  const LB = "#ffffff"
  const BG = "rgba(99,102,241,0.88)"
  // Vértices da caixa isométrica:
  // Topo:    T(140,30) R(210,68) B(140,106) L(70,68)
  // Esq:     TL(70,68) BL(70,140) BR(140,178) TR(140,106)
  // Dir:     TL(140,106) TR(210,68) BR(210,140) BL(140,178)
  return (
    <div className="flex flex-col items-center select-none w-full">
      <svg viewBox="-36 0 316 244" className="w-full" fill="none" xmlns="http://www.w3.org/2000/svg">

        {/* ── Faces ── */}
        <path d="M140 30 L210 68 L140 106 L70 68 Z"    fill={FT} stroke={ST} strokeWidth="2" strokeLinejoin="round"/>
        <path d="M70 68 L140 106 L140 178 L70 140 Z"   fill={FL} stroke={ST} strokeWidth="2" strokeLinejoin="round"/>
        <path d="M140 106 L210 68 L210 140 L140 178 Z" fill={FR} stroke={ST} strokeWidth="2" strokeLinejoin="round"/>

        {/* ── ALTURA: seta vertical — deslocada para x=10, longe da face ── */}
        <line x1="10" y1="68"  x2="70" y2="68"  stroke={AR} strokeWidth="1.1" strokeDasharray="3 3" opacity="0.5"/>
        <line x1="10" y1="140" x2="70" y2="140" stroke={AR} strokeWidth="1.1" strokeDasharray="3 3" opacity="0.5"/>
        <line x1="10" y1="76"  x2="10" y2="90"  stroke={AR} strokeWidth="1.8" strokeDasharray="6 4"/>
        <line x1="10" y1="114" x2="10" y2="132" stroke={AR} strokeWidth="1.8" strokeDasharray="6 4"/>
        <polyline points="5,79 10,69 15,79"   fill="none" stroke={AR} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="5,129 10,139 15,129" fill="none" stroke={AR} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="-13" y="93" width="46" height="18" rx="5" fill={BG}/>
        <text x="10" y="106" fontSize="10" fill={LB} fontFamily="system-ui,sans-serif" fontWeight="800" textAnchor="middle">ALTURA</text>

        {/* ── LARGURA: seta ao longo da base esquerda (70,140)→(140,178) ──
             Direção unit: (70,38)/79.6 ≈ (0.879,0.477)
             Perp outward (CCW 90°): (-0.477,0.879) × 14px → offset (-6.7,+12.3)  */}
        {/* guias conectando à aresta */}
        <line x1="70"  y1="140" x2="63"  y2="153" stroke={AR} strokeWidth="1.1" strokeDasharray="3 3" opacity="0.5"/>
        <line x1="140" y1="178" x2="133" y2="191" stroke={AR} strokeWidth="1.1" strokeDasharray="3 3" opacity="0.5"/>
        {/* linha principal */}
        <line x1="63" y1="153" x2="133" y2="191" stroke={AR} strokeWidth="1.8" strokeDasharray="6 4"/>
        {/* seta esquerda: tip=(63,153), braços de volta na direção (0.879,0.477) + spread perp(-0.477,0.879)×5 */}
        <polyline points="68,162 63,153 74,151" fill="none" stroke={AR} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        {/* seta direita: tip=(133,191) */}
        <polyline points="122,192 133,191 128,181" fill="none" stroke={AR} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        {/* badge — "LARGURA" ~54px */}
        <rect x="67" y="195" width="58" height="18" rx="5" fill={BG}/>
        <text x="96" y="208" fontSize="10" fill={LB} fontFamily="system-ui,sans-serif" fontWeight="800" textAnchor="middle">LARGURA</text>

        {/* ── COMPRIMENTO: seta ao longo da base direita (140,178)→(210,140) ──
             Direção unit: (70,-38)/79.6 ≈ (0.879,-0.477)
             Perp outward (CCW 90°): (0.477,0.879) × 14px → offset (+6.7,+12.3)  */}
        {/* guias conectando à aresta */}
        <line x1="140" y1="178" x2="147" y2="191" stroke={AR} strokeWidth="1.1" strokeDasharray="3 3" opacity="0.5"/>
        <line x1="210" y1="140" x2="217" y2="153" stroke={AR} strokeWidth="1.1" strokeDasharray="3 3" opacity="0.5"/>
        {/* linha principal */}
        <line x1="147" y1="191" x2="217" y2="153" stroke={AR} strokeWidth="1.8" strokeDasharray="6 4"/>
        {/* seta esquerda: tip=(147,191) */}
        <polyline points="158,191 147,191 152,181" fill="none" stroke={AR} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        {/* seta direita: tip=(217,153) */}
        <polyline points="206,152 217,153 212,163" fill="none" stroke={AR} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        {/* badge — "COMPRIMENTO" ~82px */}
        <rect x="147" y="195" width="82" height="18" rx="5" fill={BG}/>
        <text x="188" y="208" fontSize="10" fill={LB} fontFamily="system-ui,sans-serif" fontWeight="800" textAnchor="middle">COMPRIMENTO</text>

      </svg>
    </div>
  )
}

// ── Animação ─────────────────────────────────────────────
const variants = {
  enter:  (d: number) => ({ x: d > 0 ?  60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: d > 0 ? -60 :  60, opacity: 0 }),
}

type CepStatus = "idle" | "buscando" | "encontrado" | "invalido" | "manual"

// ── Modal Rastreio ─────────────────────────────────────────
function ModalRastreio({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["rastreio", orderId],
    queryFn: () => apiGet<{ tracking: string; events: Array<{ description: string; date: string; location: string }> }>(`/etiquetas/rastrear?order_id=${orderId}`),
    staleTime: 120_000,
  })

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 backdrop-blur-md" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <MapPin size={15} style={{ color: "var(--accent)" }} /> Rastreamento
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
            <X size={17} />
          </button>
        </div>
        <div className="p-6">
          {isLoading && <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }} /></div>}
          {error && <p className="text-center py-8 text-sm" style={{ color: "#f87171" }}>Não foi possível rastrear.</p>}
          {data && (
            <div>
              <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl" style={{ background: "var(--bg-surface)" }}>
                <Info size={13} style={{ color: "var(--text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Código: <span className="font-mono" style={{ color: "var(--text-primary)" }}>{data.tracking}</span></p>
              </div>
              <div className="space-y-0 max-h-72 overflow-y-auto pr-1">
                {(data.events ?? []).length === 0 ? (
                  <p className="text-center py-6 text-sm" style={{ color: "var(--text-muted)" }}>Nenhum evento ainda.</p>
                ) : data.events.map((ev, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5 shrink-0",
                        i === 0 ? "bg-blue-400 ring-4 ring-blue-400/20" : "bg-slate-700")} />
                      {i < (data.events?.length ?? 0) - 1 && <div className="w-px flex-1 mt-1" style={{ background: "var(--border)" }} />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm" style={{ color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)" }}>{ev.description}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{ev.location} · {ev.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ── Wizard Nova Etiqueta ────────────────────────────────────
function WizardEtiqueta({ onClose, onSalvo }: { onClose: () => void; onSalvo: () => void }) {
  const [step, setStep]           = useState(1)
  const [dir, setDir]             = useState(1)
  const [form, setForm]           = useState<ShipForm>(EMPTY_FORM)
  const [erro, setErro]           = useState("")
  const [cepStatus, setCepStatus] = useState<CepStatus>("idle")

  // Step 5 — frete
  const [servicos, setServicos]   = useState<Servico[]>([])
  const [servicoSel, setServicoSel] = useState<Servico | null>(null)
  const [cotando, setCotando]     = useState(false)
  const [erroFrete, setErroFrete] = useState("")

  // Step 6 — gerando
  const [gerando, setGerando]     = useState(false)
  const [orderResult, setOrder]   = useState<{ id: string; label_url?: string } | null>(null)
  const [salvoOk, setSalvoOk]     = useState(false)

  // Valor declarado — exibe formatado ao sair do campo
  const [valorFormatado, setValorFormatado] = useState("")

  const inputRef = useRef<HTMLInputElement>(null)
  const TOTAL = 6

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  // Busca de cliente para auto-preencher
  const [cliBusca, setCliBusca]   = useState("")
  const [cliRes, setCliRes]       = useState<Cliente[]>([])
  const [cliSel, setCliSel]       = useState<Cliente | null>(null)
  // Modal 2B: endereço de entrega ≠ cadastro
  const [modalEntrega, setModalEntrega] = useState<Cliente | null>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 280)
    return () => clearTimeout(t)
  }, [step])

  const buscarClientes = useCallback(async (val: string) => {
    setCliBusca(val); setCliSel(null)
    if (val.length < 2) { setCliRes([]); return }
    try {
      const res = await apiGet<{ data: Cliente[] }>(`/clientes?busca=${encodeURIComponent(val)}&limit=8`)
      setCliRes(res.data ?? [])
    } catch { setCliRes([]) }
  }, [])

  // Preenche os campos de endereço do form a partir de um endereço dado.
  function aplicarEndereco(end: Endereco) {
    setForm(f => ({
      ...f,
      cep:         end.cep ?? "",
      logradouro:  end.logradouro ?? "",
      numero:      end.numero ?? "",
      complemento: end.complemento ?? "",
      bairro:      end.bairro ?? "",
      cidade:      end.cidade ?? "",
      estado:      end.estado ?? "",
    }))
    setCepStatus(end.logradouro ? "encontrado" : "idle")
  }

  // True se o cliente tem endereço de entrega preenchido e diferente do cadastro.
  function temEntregaDivergente(c: Cliente): boolean {
    const temEntrega = !!(c.entrega_logradouro || c.entrega_cep)
    if (!temEntrega) return false
    const dif = (a?: string | null, b?: string | null) =>
      (a ?? "").trim().toLowerCase() !== (b ?? "").trim().toLowerCase()
    return (
      dif(c.entrega_cep, c.cep) ||
      dif(c.entrega_logradouro, c.logradouro) ||
      dif(c.entrega_numero, c.numero) ||
      dif(c.entrega_bairro, c.bairro) ||
      dif(c.entrega_cidade, c.cidade) ||
      dif(c.entrega_estado, c.estado)
    )
  }

  function selecionarCliente(c: Cliente) {
    setCliSel(c)
    setCliBusca(c.nome)
    setCliRes([])
    // Dados pessoais sempre vêm do cadastro
    setForm(f => ({ ...f, nome: c.nome ?? "", cpf: c.cpf_cnpj ?? "", telefone: c.celular ?? "" }))
    // Endereço: por padrão usa o do cadastro
    aplicarEndereco({
      cep: c.cep, logradouro: c.logradouro, numero: c.numero,
      complemento: c.complemento, bairro: c.bairro, cidade: c.cidade, estado: c.estado,
    })
    // 2B: se houver endereço de entrega divergente, pergunta qual usar
    if (temEntregaDivergente(c)) setModalEntrega(c)
  }

  const { hi: cliHi, onKeyDown: cliDropKeyDown, reset: resetCliHi } = useDropdownKeyNav(cliRes, selecionarCliente)

  function set(k: keyof ShipForm, v: string) {
    setForm(f => ({ ...f, [k]: v })); setErro("")
  }

  function go(next: number) { setDir(next > step ? 1 : -1); setStep(next); setErro("") }

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

  async function advanceCep() {
    const limpo = form.cep.replace(/\D/g, "")
    if (!limpo) { go(step + 1); return }
    if (cepStatus === "encontrado" || cepStatus === "manual") { go(step + 1); return }
    if (cepStatus === "invalido") { setErro("Corrija o CEP ou preencha manualmente."); return }
    const ok = await buscarCep(form.cep)
    if (ok) go(step + 1)
  }

  async function cotar() {
    setCotando(true); setErroFrete("")
    try {
      const res = await apiPost<{ servicos: Servico[]; erros: unknown[] }>("/etiquetas/cotacao", {
        cep_destino: form.cep.replace(/\D/g, ""),
        peso: form.peso, altura: form.altura,
        largura: form.largura, comprimento: form.comprimento,
      })
      setServicos(res.servicos ?? [])
    } catch (e: unknown) {
      setErroFrete((e as Error).message || "Erro ao calcular frete.")
    } finally { setCotando(false) }
  }

  const [pixData, setPixData] = useState<{ order_id: string; copy_paste: string | null; qr_code_base64: string | null; expires_at: string | null } | null>(null)
  const [gerindoPix, setGerindoPix] = useState(false)
  const [confirmandoPix, setConfirmandoPix] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const destinatarioPayload = () => ({
    nome: form.nome, telefone: form.telefone, cpf: form.cpf,
    logradouro: form.logradouro, numero: form.numero,
    bairro: form.bairro, cidade: form.cidade, estado: form.estado,
    complemento: form.complemento,
    postal_code: form.cep.replace(/\D/g, ""),
    peso: form.peso, altura: form.altura,
    largura: form.largura, comprimento: form.comprimento,
    valor_declarado: form.valor_declarado || undefined,
  })

  async function gerar(checkout_auto: boolean) {
    if (!servicoSel) return
    setGerando(true)
    try {
      const res = await apiPost<{ id: string; label_url?: string }>("/etiquetas", {
        service_id: servicoSel.id,
        venda_id: form.venda_id ? parseInt(form.venda_id) : undefined,
        checkout_auto,
        destinatario: destinatarioPayload(),
      })
      setOrder(res)
      setSalvoOk(true)
      setTimeout(() => { setSalvoOk(false); onSalvo() }, 2200)
    } catch (e: unknown) {
      setErroFrete((e as Error).message || "Erro ao gerar etiqueta.")
    } finally { setGerando(false) }
  }

  async function gerarPix() {
    if (!servicoSel) return
    setGerindoPix(true); setErroFrete("")
    try {
      const res = await apiPost<{ gerado: boolean; order_id: string; copy_paste?: string; qr_code_base64?: string; expires_at?: string }>("/etiquetas/pix", {
        service_id: servicoSel.id,
        venda_id: form.venda_id ? parseInt(form.venda_id) : undefined,
        destinatario: destinatarioPayload(),
      })
      setPixData({ order_id: res.order_id, copy_paste: res.copy_paste ?? null, qr_code_base64: res.qr_code_base64 ?? null, expires_at: res.expires_at ?? null })
    } catch (e: unknown) {
      setErroFrete((e as Error).message || "Não foi possível gerar o PIX da etiqueta.")
    } finally { setGerindoPix(false) }
  }

  async function confirmarPagamentoPix() {
    if (!pixData) return
    setConfirmandoPix(true); setErroFrete("")
    try {
      const res = await apiPost<{ gerado: boolean; id: string; label_url?: string; tracking?: string }>("/etiquetas/pix", { order_id: pixData.order_id })
      setPixData(null)
      setOrder(res)
      setSalvoOk(true)
      setTimeout(() => { setSalvoOk(false); onSalvo() }, 2200)
    } catch (e: unknown) {
      setErroFrete((e as Error).message || "Pagamento ainda não confirmado. Aguarde e tente novamente.")
    } finally { setConfirmandoPix(false) }
  }

  function copiarPix(txt: string) {
    navigator.clipboard.writeText(txt).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2500) })
  }

  function advance() {
    if (step === 1 && !cliSel) { setErro("Selecione um cliente cadastrado"); return }
    if (step === 2) { advanceCep(); return }
    if (step < TOTAL) go(step + 1)
  }

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step < TOTAL && step !== 4 && step !== 5) {
      e.preventDefault(); advance()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, cepStatus])

  const iBase = "w-full px-5 py-4 text-lg rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }
  const iSmBase = "w-full px-4 py-3 text-base rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>

      <SuccessOverlay show={salvoOk} titulo="Etiqueta gerada!" subtitulo={form.nome || ""} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: COR }}>Brechó Bellasu</span>
          <span style={{ color: "var(--border-hover)" }}>|</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Nova Etiqueta</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>{step} / {TOTAL}</span>
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
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
              className={(step === 5 || step === 4)
                ? "absolute inset-0 flex flex-col"
                : "absolute inset-0 flex flex-col items-center justify-center px-6 overflow-y-auto py-10"}>
              {/* Wrapper — step 4 e 5 são fullscreen, demais têm max-w-xl */}
              <div className={(step === 5 || step === 4) ? "flex flex-col flex-1 min-h-0 w-full" : "w-full max-w-xl"}>
                {step !== 5 && step !== 4 && (
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-base font-bold" style={{ color: COR }}>{step}</span>
                    <ArrowRight size={14} style={{ color: COR }} />
                  </div>
                )}

                {/* ── Step 1: Destinatário ── */}
                {step === 1 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Destinatário?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Busque o cadastro do cliente para preencher os dados automaticamente.</p>

                  {/* Busca cliente */}
                  <div className="relative mb-4">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                    <input
                      ref={inputRef}
                      value={cliBusca}
                      onChange={e => { buscarClientes(e.target.value); resetCliHi() }}
                      onKeyDown={cliDropKeyDown}
                      placeholder="Buscar cliente por nome ou CPF"
                      className={cn(iBase, "pl-12")} style={iSt} autoComplete="off" />
                  </div>

                  {/* Dropdown resultados */}
                  {cliRes.length > 0 && (
                    <div className="mb-4 rounded-2xl overflow-hidden shadow-lg"
                      style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
                      {cliRes.map((c, idx) => (
                        <button key={c.id} onClick={() => selecionarCliente(c)}
                          className="w-full px-4 py-3.5 text-left flex items-center gap-3 transition-colors"
                          style={{ borderBottom: "1px solid var(--border)", background: cliHi === idx ? "var(--accent-bg)" : "transparent" }}
                          onMouseEnter={e => { if (cliHi !== idx) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
                          onMouseLeave={e => { if (cliHi !== idx) (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                            style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                            {c.nome[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold uppercase truncate" style={{ color: cliHi === idx ? "var(--accent)" : "var(--text-primary)" }}>{c.nome}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {[c.cpf_cnpj, c.celular].filter(Boolean).join(" · ") || "Sem CPF/Telefone"}
                            </p>
                          </div>
                          {cliSel?.id === c.id && <BadgeCheck size={16} style={{ color: COR }} />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Cliente selecionado */}
                  {cliSel ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="px-5 py-4 rounded-2xl"
                      style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)" }}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                          style={{ background: COR, color: "#fff" }}>
                          {cliSel.nome[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sm uppercase" style={{ color: "var(--text-primary)" }}>{cliSel.nome}</p>
                          <p className="text-xs flex items-center gap-1" style={{ color: "#a5b4fc" }}>
                            <Check size={10} /> Dados preenchidos automaticamente
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {cliSel.cpf_cnpj && (
                          <div className="px-3 py-2 rounded-xl" style={{ background: "rgba(99,102,241,0.12)" }}>
                            <p style={{ color: "#a5b4fc" }}>CPF/CNPJ</p>
                            <p className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>{cliSel.cpf_cnpj}</p>
                          </div>
                        )}
                        {cliSel.celular && (
                          <div className="px-3 py-2 rounded-xl" style={{ background: "rgba(99,102,241,0.12)" }}>
                            <p style={{ color: "#a5b4fc" }}>Telefone</p>
                            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{cliSel.celular}</p>
                          </div>
                        )}
                        {cliSel.cidade && (
                          <div className="px-3 py-2 rounded-xl col-span-2" style={{ background: "rgba(99,102,241,0.12)" }}>
                            <p style={{ color: "#a5b4fc" }}>Endereço</p>
                            <p className="font-semibold uppercase" style={{ color: "var(--text-primary)" }}>
                              {[cliSel.logradouro, cliSel.numero, cliSel.cidade, cliSel.estado].filter(Boolean).join(", ")}
                            </p>
                          </div>
                        )}
                      </div>
                      <button onClick={() => { setCliSel(null); setCliBusca(""); setForm(f => ({ ...f, nome: "", cpf: "", telefone: "", cep: "", logradouro: "", bairro: "", cidade: "", estado: "", numero: "", complemento: "" })) }}
                        className="mt-3 text-xs underline underline-offset-2"
                        style={{ color: "#818cf8" }}>
                        Trocar cliente
                      </button>
                    </motion.div>
                  ) : cliBusca.length < 2 && (
                    <p className="text-sm text-left py-2 pl-1" style={{ color: "var(--text-muted)" }}>
                      Digite ao menos 2 caracteres para buscar
                    </p>
                  )}
                </>}

                {/* ── Step 2: CEP ── */}
                {step === 2 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Qual o CEP de destino?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>O endereço é preenchido automaticamente.</p>

                  <div className="relative">
                    <input ref={inputRef} value={form.cep}
                      onChange={e => { set("cep", e.target.value); setCepStatus("idle") }}
                      onBlur={e => {
                        const limpo = e.target.value.replace(/\D/g, "")
                        if (limpo.length === 8 && cepStatus === "idle") buscarCep(e.target.value)
                      }}
                      placeholder="00000-000"
                      className={iBase}
                      style={{ ...iSt, borderColor: cepStatus === "encontrado" ? "#10b981" : cepStatus === "invalido" ? "#f87171" : "var(--border)" }}
                      maxLength={9} />
                    {cepStatus === "buscando" && <Loader2 size={18} className="animate-spin absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "var(--accent)" }} />}
                    {cepStatus === "encontrado" && <Check size={18} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "#10b981" }} />}
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
                            {[form.cidade, form.estado].filter(Boolean).join(" – ")}
                          </p>
                        </div>
                      </motion.div>
                    )}
                    {cepStatus === "invalido" && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={15} style={{ color: "#f87171" }} />
                          <p className="text-sm font-medium" style={{ color: "#f87171" }}>CEP não encontrado.</p>
                        </div>
                        <button onClick={() => { setCepStatus("manual"); setErro("") }}
                          className="text-xs font-medium underline underline-offset-2"
                          style={{ color: "var(--text-muted)" }}>
                          Preencher endereço manualmente →
                        </button>
                      </motion.div>
                    )}
                    {cepStatus === "manual" && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-2">
                        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Preencha manualmente:</p>
                        <input value={form.logradouro} onChange={e => set("logradouro", e.target.value)}
                          placeholder="Rua / Avenida" className={cn(iBase, "!text-base !py-3")} style={iSt} />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={form.bairro} onChange={e => set("bairro", e.target.value)}
                            placeholder="Bairro" className={cn(iBase, "!text-base !py-3")} style={iSt} />
                          <input value={form.cidade} onChange={e => set("cidade", e.target.value)}
                            placeholder="Cidade" className={cn(iBase, "!text-base !py-3")} style={iSt} />
                        </div>
                        <input value={form.estado} onChange={e => set("estado", e.target.value)}
                          placeholder="UF" maxLength={2} className={cn(iBase, "!text-base !py-3")} style={iSt} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>}

                {/* ── Step 3: Número e Complemento ── */}
                {step === 3 && <>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Número e complemento?</h1>
                  <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                    {form.logradouro ? <span style={{ color: "var(--text-secondary)" }}>{form.logradouro}, {form.cidade}</span> : "Apto, casa, bloco, etc."}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Número *</p>
                      <input ref={inputRef} value={form.numero} onChange={e => set("numero", e.target.value)}
                        placeholder="123" className={iBase} style={iSt} autoComplete="off" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Complemento</p>
                      <input value={form.complemento} onChange={e => set("complemento", e.target.value)}
                        placeholder="APTO, CASA, BLOCO..." className={iBase} style={iSt} />
                    </div>
                  </div>
                </>}

                {/* ── Step 4: Embalagem — FULLSCREEN 2 colunas ── */}
                {step === 4 && <>
                  {/* Header — centrado */}
                  <div className="flex flex-col items-center text-center px-6 pt-5 pb-3 shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold" style={{ color: COR }}>4</span>
                      <ArrowRight size={14} style={{ color: COR }} />
                    </div>
                    <h1 className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>Dados da embalagem?</h1>
                    <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Peso e dimensões da caixa para calcular o frete.</p>
                  </div>

                  {/* Corpo — 2 colunas */}
                  <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 px-4 pb-3 overflow-hidden">

                    {/* ── Esquerda: Diagrama ── */}
                    <div className="lg:flex-1 flex flex-col items-center justify-center rounded-3xl p-5 relative shrink-0"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                      {/* Badge */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
                        <span>⚠</span> Apenas um exemplo visual
                      </div>
                      <BoxDiagram altura={form.altura} largura={form.largura} comprimento={form.comprimento} />
                      <p className="text-xs mt-4 text-center" style={{ color: "var(--text-muted)" }}>
                        Atualiza conforme você preenche as dimensões →
                      </p>
                    </div>

                    {/* ── Direita: Campos ── */}
                    <div className="lg:flex-1 flex flex-col gap-3 justify-between">
                      {/* 4 dimensões */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Peso (kg) *",      field: "peso"        as keyof ShipForm, step: "0.1", ref: inputRef },
                          { label: "Altura (cm)",       field: "altura"      as keyof ShipForm, step: "1"   },
                          { label: "Largura (cm)",      field: "largura"     as keyof ShipForm, step: "1"   },
                          { label: "Comprimento (cm)",  field: "comprimento" as keyof ShipForm, step: "1"   },
                        ].map(({ label, field, step: s, ref: r }) => (
                          <div key={field}>
                            <p className="text-xs font-black uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
                              style={{ color: "var(--text-muted)" }}>
                              {field === "peso" ? <Weight size={11}/> : <Ruler size={11}/>} {label}
                            </p>
                            <input ref={r} type="number" step={s} min={s} value={form[field]}
                              onChange={e => set(field, e.target.value)}
                              className="w-full px-4 py-4 text-xl font-bold rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
                              style={iSt} />
                          </div>
                        ))}
                      </div>

                      {/* Valor declarado + Nº Venda */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Valor declarado (R$)</p>
                          <input type="text" inputMode="decimal"
                            value={valorFormatado !== "" ? valorFormatado : form.valor_declarado}
                            onFocus={() => setValorFormatado("")}
                            onChange={e => { setValorFormatado(""); set("valor_declarado", e.target.value.replace(/[^0-9.,]/g, "")) }}
                            onBlur={() => {
                              const n = parseFloat(form.valor_declarado.replace(",", "."))
                              if (!isNaN(n) && n > 0) setValorFormatado(fmtBRL(n))
                              else setValorFormatado("")
                            }}
                            placeholder="R$ 0,00"
                            className="w-full px-4 py-4 text-xl font-bold rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
                            style={iSt} />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Nº Venda (opcional)</p>
                          <input type="number" value={form.venda_id}
                            onChange={e => set("venda_id", e.target.value)}
                            placeholder="—"
                            className="w-full px-4 py-4 text-xl font-bold rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
                            style={iSt} />
                        </div>
                      </div>

                      {/* Botão continuar próprio */}
                      <button onClick={advance}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-white shadow-lg transition-opacity"
                        style={{ background: COR }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                        Continuar <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </>}

                {/* ── Step 5: Escolher frete — FULLSCREEN ── */}
                {step === 5 && <>
                  {/* Header — centrado */}
                  <div className="flex flex-col items-center text-center px-6 pt-5 pb-4 shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base font-bold" style={{ color: COR }}>5</span>
                      <ArrowRight size={14} style={{ color: COR }} />
                    </div>
                    <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Escolher frete?</h1>
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                      Destino: <span style={{ color: "var(--text-secondary)" }}>{form.cidade}/{form.estado} · CEP {form.cep}</span>
                    </p>
                  </div>

                  {/* Erro */}
                  {erroFrete && (
                    <div className="mx-6 mb-3 flex items-start gap-2 px-4 py-3 rounded-2xl shrink-0"
                      style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)" }}>
                      <AlertCircle size={15} style={{ color: "#f87171" }} className="shrink-0 mt-0.5" />
                      <p className="text-sm" style={{ color: "#f87171" }}>{erroFrete}</p>
                    </div>
                  )}

                  {/* Calcular */}
                  {servicos.length === 0 && !cotando && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
                      <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                        style={{ background: `${COR}18`, border: `2px solid ${COR}40` }}>
                        <Truck size={36} style={{ color: COR }} />
                      </div>
                      <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
                        Clique para buscar as opções de frete disponíveis para este destino.
                      </p>
                      <button onClick={cotar}
                        className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-lg shadow-xl transition-opacity"
                        style={{ background: COR }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                        <Truck size={20} /> Calcular fretes disponíveis
                      </button>
                    </div>
                  )}

                  {/* Calculando */}
                  {cotando && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                      <Loader2 size={36} className="animate-spin" style={{ color: COR }} />
                      <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Calculando fretes...</p>
                    </div>
                  )}

                  {/* Cards de frete — grid 2×2, sem scroll, preenche tela */}
                  {servicos.length > 0 && (
                    <div className="flex-1 min-h-0 px-4 pb-2 grid gap-3"
                      style={{
                        gridTemplateColumns: servicos.length > 10 ? "1fr 1fr 1fr" : "1fr 1fr",
                        gridTemplateRows: `repeat(${Math.ceil(servicos.length / (servicos.length > 10 ? 3 : 2))}, 1fr)`,
                      }}>
                      {servicos.map((s, i) => {
                        const grad = carrierGradient(s.company.name)
                        const isSelected = servicoSel?.id === s.id
                        return (
                          <motion.button key={s.id}
                            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05, duration: 0.25, ease: [0.22,1,0.36,1] }}
                            whileHover={{ scale: 1.015 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setServicoSel(s)}
                            className={cn(
                              "relative w-full text-left rounded-2xl border bg-gradient-to-br overflow-hidden transition-all",
                              grad,
                              isSelected ? "ring-2 ring-blue-500 border-blue-500/50" : "hover:border-white/20"
                            )}
                            style={{ transition: "border-color 0.2s, box-shadow 0.2s",
                              boxShadow: isSelected ? `0 0 0 2px rgba(59,130,246,0.4), 0 8px 32px rgba(0,0,0,0.25)` : undefined }}>

                            {isSelected && (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="absolute inset-0 pointer-events-none"
                                style={{ background: "rgba(59,130,246,0.06)" }} />
                            )}

                            <div className="relative z-10 flex items-center gap-3 px-4 py-3 h-full">
                              {/* Logo */}
                              <div className="shrink-0 flex items-center justify-center rounded-xl w-14 h-12"
                                style={{ background: "rgba(255,255,255,0.1)" }}>
                                {s.company.picture
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={s.company.picture} alt={s.company.name} className="w-12 h-8 object-contain" />
                                  : <Truck size={20} style={{ color: "var(--text-muted)" }} />}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-black text-sm tracking-wide uppercase" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                                  {i === 0 && (
                                    <span className="flex items-center gap-0.5 text-[9px] font-bold bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                                      <Star size={8} fill="currentColor" /> Melhor preço
                                    </span>
                                  )}
                                  {isSelected && (
                                    <span className="flex items-center gap-0.5 text-[9px] font-bold bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded-full">
                                      <CheckCircle2 size={8} fill="currentColor" /> Selecionado
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.company.name}</p>
                                  <span className="flex items-center gap-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                                    <Clock size={10} />
                                    {s.delivery_range.min}–{s.delivery_range.max}d
                                  </span>
                                  {s.discount && s.discount.percentage > 0 && (
                                    <span className="text-xs font-semibold text-emerald-400">{s.discount.percentage}% off</span>
                                  )}
                                </div>
                              </div>

                              {/* Preço */}
                              <div className="shrink-0 text-right">
                                <p className="font-black text-lg leading-tight"
                                  style={{ color: isSelected ? "#60a5fa" : "var(--text-primary)" }}>
                                  {fmtBRL(parseFloat(s.price))}
                                </p>
                              </div>
                            </div>

                            {isSelected && (
                              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                                className="absolute bottom-0 left-0 right-0 h-[3px] origin-left"
                                style={{ background: "#3b82f6" }} />
                            )}
                          </motion.button>
                        )
                      })}
                    </div>
                  )}

                  {/* Bottom bar */}
                  <AnimatePresence>
                    {servicoSel && servicos.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="shrink-0 px-4 pt-3 pb-4"
                        style={{ borderTop: "1px solid var(--border)" }}>
                        <button onClick={() => gerar(true)} disabled={gerando}
                          className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                          style={{ background: COR }}>
                          {gerando
                            ? <><Loader2 size={16} className="animate-spin" />Gerando...</>
                            : <><Tag size={16} />Gerar Etiqueta</>}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>}

                {/* Erro (steps 1-4) */}
                {step !== 5 && (
                  <AnimatePresence>
                    {erro && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-3 text-sm" style={{ color: "#f87171" }}>{erro}</motion.p>}
                  </AnimatePresence>
                )}

                {/* Botões — step 4 e 5 não mostram (usam botões próprios) */}
                {step !== 5 && step !== 4 && (
                  <div className="flex items-center gap-4 mt-8">
                    <button onClick={advance} disabled={cepStatus === "buscando"}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg transition-opacity disabled:opacity-50"
                      style={{ background: COR }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                      {cepStatus === "buscando" ? <><Loader2 size={14} className="animate-spin" />Buscando...</> : (
                        <>{step === 1 ? "OK, continuar" : "Continuar"} <ArrowRight size={15} /></>
                      )}
                    </button>
                    {step > 1 && cepStatus !== "buscando" && (
                      <button onClick={() => go(step + 1)}
                        className="text-sm font-medium transition-colors" style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                        Pular →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

          ) : (
            /* ── Step 6: Sucesso / Revisão ── */
            <motion.div key="sucesso" custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="absolute inset-0 flex">

              {/* Sidebar */}
              <div className="w-64 shrink-0 flex flex-col items-center justify-between py-10 px-6"
                style={{ background: COR }}>
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative">
                    {orderResult ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="w-20 h-20 rounded-full flex items-center justify-center bg-white/20">
                        <CheckCircle2 size={40} color="#fff" />
                      </motion.div>
                    ) : (
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                        <Tag size={32} color="#fff" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-lg leading-tight text-white">
                      {orderResult ? "Etiqueta criada!" : "Confirmar envio"}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
                      {servicoSel ? `${servicoSel.company.name} · ${fmtBRL(parseFloat(servicoSel.price))}` : ""}
                    </p>
                  </div>
                </div>
                <div className="w-full space-y-2">
                  {orderResult?.label_url && (
                    <motion.a
                      href={orderResult.label_url} target="_blank" rel="noopener noreferrer"
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
                      style={{ background: "#fff", color: COR }}>
                      <Printer size={16} /> Imprimir Etiqueta
                    </motion.a>
                  )}
                  {orderResult?.label_url && (
                    <a href={orderResult.label_url} target="_blank" rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-2xl text-xs font-medium flex items-center justify-center gap-2"
                      style={{ background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.7)" }}>
                      <Download size={12} /> Baixar PDF
                    </a>
                  )}
                  <a href="https://melhorenvio.com.br/painel/gerenciar/envios" target="_blank" rel="noopener noreferrer"
                    className="w-full py-2.5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
                    style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}>
                    <ExternalLink size={14} /> Painel ME
                  </a>
                  <button onClick={onClose} className="w-full py-2.5 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Fechar
                  </button>
                </div>
              </div>

              {/* Painel revisão */}
              <div className="flex-1 overflow-y-auto p-10" style={{ background: "var(--bg-base)" }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-6" style={{ color: "var(--text-muted)" }}>
                  ◎ Dados da Etiqueta
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Destinatário", value: form.nome || "—",                                              s: 1, full: true },
                    { label: "CPF / CNPJ",   value: form.cpf || "—",                                               s: 1 },
                    { label: "Telefone",      value: form.telefone || "—",                                          s: 1 },
                    { label: "CEP",           value: form.cep || "—",                                               s: 2 },
                    { label: "Endereço",      value: [form.logradouro, form.numero && `nº ${form.numero}`, form.complemento, form.bairro, `${form.cidade}/${form.estado}`].filter(Boolean).join(", ") || "—", s: 3, full: true },
                    { label: "Peso",          value: `${form.peso} kg`,                                            s: 4 },
                    { label: "Dimensões",     value: `${form.altura}×${form.largura}×${form.comprimento} cm`,       s: 4 },
                    ...(servicoSel ? [{ label: "Frete", value: `${servicoSel.name} · ${fmtBRL(parseFloat(servicoSel.price))}`, s: 5, full: true }] : []),
                  ].map(({ label, value, s, full }) => (
                    <div key={label} className={cn("rounded-2xl p-4", full ? "col-span-2" : "")}
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${COR}` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{value}</p>
                      <button onClick={() => go(s as number)} className="flex items-center gap-1 text-xs mt-1.5 transition-opacity"
                        style={{ color: COR }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.65" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                        ✎ editar
                      </button>
                    </div>
                  ))}
                </div>

                {!orderResult && (
                  <div className="mt-6 flex gap-2">
                    <button onClick={() => go(5)} className="flex-1 py-3 rounded-2xl text-sm font-medium transition-colors"
                      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)" }}>
                      ← Escolher frete
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer — oculto nos steps 4 e 5 (têm seus próprios controles) */}
      {step < TOTAL && step !== 5 && step !== 4 && (
        <div className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}>
          {step > 1 ? (
            <button onClick={() => go(step - 1)}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: "var(--text-secondary)" }}
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

      {/* 2B — Modal: endereço de entrega ≠ cadastro */}
      <AnimatePresence>
        {modalEntrega && (
          <ModalEnderecoEntrega
            cliente={modalEntrega}
            onUsarEntrega={() => {
              aplicarEndereco({
                cep: modalEntrega.entrega_cep, logradouro: modalEntrega.entrega_logradouro,
                numero: modalEntrega.entrega_numero, complemento: modalEntrega.entrega_complemento,
                bairro: modalEntrega.entrega_bairro, cidade: modalEntrega.entrega_cidade,
                estado: modalEntrega.entrega_estado,
              })
              setModalEntrega(null)
            }}
            onInformarOutro={() => {
              aplicarEndereco({})  // limpa para digitação manual
              setModalEntrega(null)
            }}
            onCancelar={() => setModalEntrega(null)}  // mantém endereço do cadastro
          />
        )}
      </AnimatePresence>

      {/* Modal PIX da etiqueta */}
      <AnimatePresence>
        {pixData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>

              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="font-bold text-sm flex items-center gap-2" style={{ color: "#10b981" }}>
                  <QrCode size={16}/> Pagar etiqueta via PIX
                </span>
                <button onClick={() => setPixData(null)}><X size={18} style={{ color: "var(--text-muted)" }}/></button>
              </div>

              <div className="p-5 space-y-4">
                {pixData.qr_code_base64 ? (
                  <div className="flex justify-center">
                    <div className="p-3 bg-white rounded-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code PIX" className="w-48 h-48" />
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <QrCode size={48} className="mx-auto mb-2 opacity-30" style={{ color: "#10b981" }}/>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Escaneie o QR Code pelo app do banco</p>
                  </div>
                )}

                {pixData.copy_paste && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Copia e Cola PIX</p>
                    <div className="flex gap-2">
                      <div className="flex-1 px-3 py-2 rounded-xl text-xs font-mono truncate"
                        style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        {pixData.copy_paste}
                      </div>
                      <button onClick={() => copiarPix(pixData.copy_paste!)}
                        className="px-3 py-2 rounded-xl text-xs font-bold"
                        style={{ background: copiado ? "rgba(16,185,129,0.15)" : "var(--bg-base)", color: copiado ? "#10b981" : "var(--text-muted)", border: "1px solid var(--border)" }}>
                        {copiado ? <Check size={14}/> : <Copy size={14}/>}
                      </button>
                    </div>
                  </div>
                )}

                {pixData.expires_at && (
                  <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
                    Válido até {new Date(pixData.expires_at).toLocaleString("pt-BR")}
                  </p>
                )}

                <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                  Após pagar, clique no botão abaixo para gerar a etiqueta.
                </p>

                <button onClick={confirmarPagamentoPix} disabled={confirmandoPix}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: "#10b981" }}>
                  {confirmandoPix ? <><Loader2 size={15} className="animate-spin"/>Verificando...</> : <><Check size={15}/>Já paguei — Gerar etiqueta</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Modal 2B — Endereço de entrega diferente do cadastro ──────
function ModalEnderecoEntrega({ cliente, onUsarEntrega, onInformarOutro, onCancelar }: {
  cliente: Cliente
  onUsarEntrega: () => void
  onInformarOutro: () => void
  onCancelar: () => void
}) {
  const linhaCad = [cliente.logradouro, cliente.numero, cliente.bairro, cliente.cidade && cliente.estado ? `${cliente.cidade}/${cliente.estado}` : cliente.cidade].filter(Boolean).join(", ")
  const linhaEnt = [cliente.entrega_logradouro, cliente.entrega_numero, cliente.entrega_bairro, cliente.entrega_cidade && cliente.entrega_estado ? `${cliente.entrega_cidade}/${cliente.entrega_estado}` : cliente.entrega_cidade].filter(Boolean).join(", ")

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onCancelar}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <AlertCircle size={18} style={{ color: "#f59e0b" }} />
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Endereço de entrega diferente</span>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Esta cliente tem um <b>endereço de entrega</b> diferente do endereço de cadastro. Qual deseja usar nesta etiqueta?
          </p>
          <div className="space-y-2">
            <div className="rounded-lg p-3" style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>📍 Cadastro</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{linhaCad || "—"}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#10b981" }}>🚚 Entrega</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{linhaEnt || "—"}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <button onClick={onUsarEntrega}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "#10b981" }}>
              Usar endereço de entrega
            </button>
            <button onClick={onInformarOutro}
              className="w-full py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              Informar outro endereço
            </button>
            <button onClick={onCancelar}
              className="w-full py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Cancelar (manter cadastro)
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Modal Saldo / Recarga ─────────────────────────────────
function ModalSaldo({ saldo, onClose, onRecargaFeita }: { saldo: number | null; onClose: () => void; onRecargaFeita: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  void onRecargaFeita // mantido na assinatura para compatibilidade

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 backdrop-blur-md" style={{ background: "rgba(0,0,0,0.72)" }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: "spring", damping: 24, stiffness: 300 }}
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)" }}>
              <Wallet2 size={17} style={{ color: COR }} />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Carteira Melhor Envio</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Saldo disponível para etiquetas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
            <X size={17} />
          </button>
        </div>

        {/* Saldo atual */}
        <div className="px-6 pt-5">
          <div className="rounded-2xl px-5 py-4 flex items-center gap-4" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "rgba(99,102,241,0.7)" }}>Saldo atual</p>
              {saldo !== null ? (
                <p className="text-3xl font-black" style={{ color: COR }}>{fmtBRL(saldo)}</p>
              ) : (
                <div className="w-24 h-8 rounded-lg animate-pulse" style={{ background: "rgba(99,102,241,0.15)" }} />
              )}
            </div>
            <div className="ml-auto">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.12)" }}>
                <Zap size={22} style={{ color: COR }} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-3">
          {/* Aviso */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Como adicionar saldo?</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              A recarga da carteira é feita diretamente no painel do Melhor Envio. Clique no botão abaixo e o saldo atualiza automaticamente após o pagamento.
            </p>
          </div>

          <a href="https://melhorenvio.com.br/painel/carrinho/adicionar-saldo" target="_blank" rel="noopener noreferrer"
            className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-lg"
            style={{ background: COR, textDecoration: "none" }}>
            <ExternalLink size={16} /> Adicionar saldo no Melhor Envio
          </a>

          <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Após o pagamento, feche e reabra esta janela para atualizar o saldo.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ── Página Principal ──────────────────────────────────────
export default function EtiquetasPage() {
  const qc = useQueryClient()
  const [showWizard, setWizard]       = useState(false)
  const [rastreioId, setRastreio]     = useState<string | null>(null)
  const [page, setPage]               = useState(1)

  const { data: status } = useQuery<StatusInfo>({
    queryKey: ["etiquetas-status"],
    queryFn: () => apiGet("/etiquetas/status"),
    staleTime: 300_000,
    retry: false,
  })

  const { data: saldoData, refetch: refetchSaldo } = useQuery<{ saldo: number }>({
    queryKey: ["etiquetas-saldo"],
    queryFn: () => apiGet("/etiquetas/saldo"),
    staleTime: 120_000,
    enabled: !!status?.configurado,
    retry: false,
  })

  const { data, isLoading, refetch } = useQuery<{
    data: MEOrder[]
    meta: { total: number; current_page: number; last_page: number }
  }>({
    queryKey: ["etiquetas", page],
    queryFn: async () => {
      const res = await apiGet<{ data: MEOrder[]; meta: { total: number; current_page: number; last_page: number } }>(`/etiquetas?page=${page}&per_page=15`)
      // Garante estrutura mesmo se ME retornar formato inesperado
      const safe = res as Record<string, unknown>
      if (!safe?.meta) return { data: (safe?.data as MEOrder[]) ?? [], meta: { total: 0, current_page: 1, last_page: 1 } }
      return res
    },
    staleTime: 60_000,
    enabled: !!status?.configurado,
    retry: false,
  })

  const cancelar = useMutation({
    mutationFn: (id: string) => apiDelete(`/etiquetas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etiquetas"] }),
  })

  const etiquetas = data?.data ?? []
  const [pdfOrderId, setPdfOrderId] = useState<string | null>(null)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>Etiquetas de Envio</h2>
        </div>
        <div className="flex items-center gap-2">
          {status?.configurado && (
            <button onClick={() => refetch()} className="p-2 rounded-xl transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
              <RefreshCw size={15} />
            </button>
          )}
          {status?.configurado && (
            <a href="https://melhorenvio.com.br/painel/gerenciar/envios" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-all"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)" }}>
              <ExternalLink size={14} /> Painel ME
            </a>
          )}
          {status?.configurado && (
            <button onClick={() => setWizard(true)}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white shadow-lg transition-opacity"
              style={{ background: COR }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
              <Plus size={16} /> Nova Etiqueta
            </button>
          )}
        </div>
      </div>

      {/* Status ME */}
      {status && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className={cn("rounded-2xl px-5 py-3.5 flex items-center gap-3",
            status.configurado ? "bg-emerald-600/8 border-emerald-600/20" : "bg-amber-600/8 border-amber-600/20")}
          style={{ border: "1px solid" }}>
          {status.configurado
            ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            : <AlertCircle size={16} className="text-amber-400 shrink-0" />}
          <div className="flex-1 flex flex-wrap items-center gap-x-5 gap-y-1">
            {status.configurado ? (
              <>
                <p className="text-emerald-300 font-medium text-sm">Melhor Envio conectado</p>
                {status.usuario && <p className="text-sm" style={{ color: "var(--text-muted)" }}>{status.usuario.nome} · {status.usuario.email}</p>}
                {status.cep_origem && <p className="text-xs" style={{ color: "var(--text-muted)" }}>CEP origem: <span className="font-mono">{status.cep_origem}</span></p>}
              </>
            ) : (
              <>
                <p className="text-amber-300 font-medium text-sm">Token não configurado</p>
                <p className="text-xs text-amber-400/70">
                  Configure <code className="bg-amber-900/30 px-1 rounded font-mono">MELHOR_ENVIO_TOKEN</code> no .env.local
                </p>
              </>
            )}
          </div>
          {/* Saldo chip — apenas exibe, sem modal */}
          {status.configurado && (
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm"
              style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.25)", color: COR }}>
              <Wallet2 size={14} />
              {saldoData !== undefined
                ? <span>{fmtBRL(saldoData.saldo ?? 0)}</span>
                : <Loader2 size={13} className="animate-spin" />}
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-60">saldo</span>
            </div>
          )}
        </motion.div>
      )}


      {/* Lista de etiquetas */}
      <div className="rounded-3xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Package size={15} style={{ color: "var(--text-muted)" }} />
            <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Etiquetas geradas</p>
            {data?.meta?.total ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                {data.meta.total}
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-h-[300px]">
          {!status?.configurado ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <Truck size={32} style={{ color: "var(--border-hover)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Integração pendente</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : etiquetas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <Package size={36} style={{ color: "var(--border-hover)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhuma etiqueta ainda</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Clique em "Nova Etiqueta" para emitir</p>
            </div>
          ) : (
            <div style={{ borderBottom: "1px solid var(--border)" }}>
              {etiquetas.map((e, i) => {
                const st = STATUS_META[e.status] ?? { label: e.status, bg: "bg-slate-700/30", text: "text-slate-400", dot: "bg-slate-500" }
                return (
                  <motion.div key={e.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-start gap-4 px-5 py-4 transition-colors"
                    style={{ borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={f => { (f.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)" }}
                    onMouseLeave={f => { (f.currentTarget as HTMLDivElement).style.background = "transparent" }}>
                    <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                      {e.company?.picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.company.picture} alt={e.company.name} className="w-10 h-10 object-contain" />
                      ) : (
                        <Truck size={18} style={{ color: "var(--text-muted)" }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate uppercase" style={{ color: "var(--text-primary)" }}>{e.to?.name ?? "—"}</p>
                          <p className="text-xs truncate uppercase" style={{ color: "var(--text-muted)" }}>
                            {e.company?.name} · {e.to ? `${e.to.city}/${e.to.state_abbr}` : "—"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {e.price && <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{fmtBRL(parseFloat(e.price))}</p>}
                          {e.delivery_range && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{e.delivery_range.min}–{e.delivery_range.max}d</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase", st.bg, st.text)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                          {st.label}
                        </span>
                        {e.protocol && <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{e.protocol}</span>}
                        {e.tracking && <span className="text-[10px] font-mono truncate max-w-[100px]" style={{ color: "var(--text-muted)" }}>{e.tracking}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {["released", "generated", "posted", "delivered"].includes(e.status) && (
                        <button onClick={() => setPdfOrderId(e.id)}
                          title="Visualizar etiqueta"
                          className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }}
                          onMouseEnter={f => { (f.currentTarget as HTMLButtonElement).style.color = "var(--accent)" }}
                          onMouseLeave={f => { (f.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                          <Printer size={14} />
                        </button>
                      )}
                      {e.tracking && (
                        <button onClick={() => setRastreio(e.id)} className="p-1.5 rounded-lg transition-all"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={f => { (f.currentTarget as HTMLButtonElement).style.color = "#4ade80" }}
                          onMouseLeave={f => { (f.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                          <MapPin size={14} />
                        </button>
                      )}
                      {e.status === "pending" && (
                        <button onClick={() => { if (confirm("Cancelar esta etiqueta?")) cancelar.mutate(e.id) }}
                          className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }}
                          onMouseEnter={f => { (f.currentTarget as HTMLButtonElement).style.color = "#f87171" }}
                          onMouseLeave={f => { (f.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Paginação */}
        {data && (data.meta?.last_page ?? 0) > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{data.meta?.total ?? 0} etiquetas</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-30"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                ← Anterior
              </button>
              <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{page} / {data.meta?.last_page ?? 1}</span>
              <button onClick={() => setPage(p => Math.min(data.meta?.last_page ?? 1, p + 1))} disabled={page === (data.meta?.last_page ?? 1)}
                className="px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-30"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showWizard && (
          <WizardEtiqueta
            onClose={() => setWizard(false)}
            onSalvo={() => { qc.invalidateQueries({ queryKey: ["etiquetas"] }) }}
          />
        )}
        {rastreioId && <ModalRastreio orderId={rastreioId} onClose={() => setRastreio(null)} />}
        {pdfOrderId && <ModalEtiquetaPDF orderId={pdfOrderId} onClose={() => setPdfOrderId(null)} />}
      </AnimatePresence>
    </div>
  )
}

// ── Modal: visualiza o PDF da etiqueta embutido no sistema ──────────
function ModalEtiquetaPDF({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const src = `/api/etiquetas/imprimir?order_id=${encodeURIComponent(orderId)}`
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        className="w-full max-w-3xl h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Printer size={16} style={{ color: "var(--accent)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Etiqueta de Envio</span>
          </div>
          <div className="flex items-center gap-1">
            <a href={src} target="_blank" rel="noopener noreferrer"
              title="Abrir em nova aba"
              className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
              onMouseEnter={f => { (f.currentTarget as HTMLAnchorElement).style.color = "var(--accent)" }}
              onMouseLeave={f => { (f.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)" }}>
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} title="Fechar"
              className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
              onMouseEnter={f => { (f.currentTarget as HTMLButtonElement).style.color = "#f87171" }}
              onMouseLeave={f => { (f.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
              <X size={16} />
            </button>
          </div>
        </div>
        <iframe src={src} title="Etiqueta" className="flex-1 w-full" style={{ background: "#fff", border: "none" }} />
      </motion.div>
    </motion.div>
  )
}
