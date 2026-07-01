"use client"

// ══════════════════════════════════════════════════════════
// Importar Compras por Foto — tira/envia foto do caderno,
// Claude Vision extrai as compras e o usuário revisa tudo
// antes de salvar. Nada é salvo sem confirmação.
// ══════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  X, Camera, ImageIcon, Sparkles, RefreshCw, Trash2, Check,
  AlertTriangle, ChevronDown, UserCheck, UserPlus, Loader2,
  CheckCircle2, XCircle, Plus, ScanLine, Wallet,
} from "lucide-react"
import { apiPost } from "@/services/api"
import { fmtBRL } from "@/lib/utils"

// ─── Tipos ────────────────────────────────────────────────
type NivelConfianca = "alta" | "media" | "baixa"

interface SugestaoCliente {
  id: number
  nome: string
  celular: string | null
  instagram: string | null
  saldo_credito: number
  match: "exato" | "parecido"
}

interface CompraLida {
  nome_cliente: string | null
  whatsapp: string | null
  instagram: string | null
  numero_sacola: string | null
  cor_sacola: string | null
  quantidade_itens: number | null
  valor_total: number | null
  observacao: string | null
  confianca: Record<string, NivelConfianca>
  sugestoes: SugestaoCliente[]
}

interface RespostaAnalise {
  legivel: boolean
  motivo: string | null
  compras: CompraLida[]
}

// Estado editável de cada compra na tela de revisão
interface CompraRevisao {
  key: number
  nome_cliente: string
  whatsapp: string
  numero_sacola: string
  cor_sacola: string
  quantidade_itens: string
  valor_total: string
  observacao: string
  confianca: Record<string, NivelConfianca>
  sugestoes: SugestaoCliente[]
  clienteSel: SugestaoCliente | null
  erroSalvar?: string
  salva?: boolean
}

type Fase = "captura" | "processando" | "revisao" | "salvando" | "concluido" | "erro"

const CORES_SACOLA = ["AMARELO","AZUL","BRANCO","LARANJA","ROSA PINK","VERDE","VERDE ÁGUA"]
const COR_LIVE = "#e11d48"

const MSGS_PROCESSANDO = [
  "Lendo as informações da imagem...",
  "Identificando clientes, sacolas e valores...",
  "Conferindo clientes já cadastradas...",
  "Organizando as compras encontradas...",
]

// ─── Compressão da imagem no cliente ──────────────────────
// Fotos de celular chegam a 12MB; reduz para ~1600px JPEG.
async function comprimirImagem(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error("Não foi possível ler a imagem"))
      i.src = url
    })
    const MAX = 1600
    const scale = Math.min(1, MAX / Math.max(img.width, img.height))
    const canvas = document.createElement("canvas")
    canvas.width  = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas indisponível")
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function numParaInput(v: number | null): string {
  if (v === null || isNaN(v)) return ""
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function inputParaNum(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0
}

// ─── Componente principal ─────────────────────────────────
export default function ImportarPorFoto({ liveId, liveData, onClose, onSalvo }: {
  liveId: number
  liveData: string
  onClose: () => void
  onSalvo: () => void
}) {
  const [fase, setFase]         = useState<Fase>("captura")
  const [imagem, setImagem]     = useState<string | null>(null)
  const [erroMsg, setErroMsg]   = useState("")
  const [msgIdx, setMsgIdx]     = useState(0)
  const [compras, setCompras]   = useState<CompraRevisao[]>([])
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, erros: 0 })

  const inputCamera  = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)
  const keyRef = useRef(0)

  // Fecha com segurança: na revisão com dados não salvos, pede confirmação
  const fecharSeguro = useCallback(() => {
    if (fase === "processando" || fase === "salvando") return
    if (fase === "revisao" && compras.some(c => !c.salva)) {
      if (!window.confirm("Descartar as compras que ainda não foram salvas?")) return
    }
    onClose()
  }, [fase, compras, onClose])

  // Esc fecha (com a mesma proteção)
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") fecharSeguro() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [fecharSeguro])

  // Rotaciona mensagens amigáveis durante o processamento
  useEffect(() => {
    if (fase !== "processando") return
    const t = setInterval(() => setMsgIdx(i => (i + 1) % MSGS_PROCESSANDO.length), 2600)
    return () => clearInterval(t)
  }, [fase])

  // ── Seleção de arquivo ──
  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // permite escolher o mesmo arquivo de novo
    if (!file) return
    if (!file.type.startsWith("image/")) { setErroMsg("Escolha um arquivo de imagem."); return }
    try {
      const dataUrl = await comprimirImagem(file)
      setImagem(dataUrl)
      setErroMsg("")
    } catch {
      setErroMsg("Não foi possível ler essa imagem. Tente outra foto.")
    }
  }

  // ── Envia para análise ──
  const analisar = useCallback(async () => {
    if (!imagem) return
    setMsgIdx(0)
    setFase("processando")
    setErroMsg("")
    try {
      const res = await apiPost<RespostaAnalise>(`/live/${liveId}/importar-foto`, { imagem })
      if (!res.legivel || res.compras.length === 0) {
        setErroMsg(res.motivo ?? "Não encontrei compras nesta imagem.")
        setFase("erro")
        return
      }
      setCompras(res.compras.map(c => ({
        key: ++keyRef.current,
        nome_cliente:     c.nome_cliente ?? "",
        whatsapp:         c.whatsapp ?? "",
        numero_sacola:    c.numero_sacola ?? "",
        cor_sacola:       c.cor_sacola ?? "",
        quantidade_itens: c.quantidade_itens != null ? String(c.quantidade_itens) : "",
        valor_total:      numParaInput(c.valor_total),
        observacao:       c.observacao ?? "",
        confianca:        c.confianca ?? {},
        sugestoes:        c.sugestoes ?? [],
        // vincula automaticamente apenas match 100%
        clienteSel:       c.sugestoes?.[0]?.match === "exato" ? c.sugestoes[0] : null,
      })))
      setFase("revisao")
    } catch (e) {
      setErroMsg(e instanceof Error ? e.message : "Erro ao analisar a imagem.")
      setFase("erro")
    }
  }, [imagem, liveId])

  // ── Edição na revisão ──
  function setCampo(key: number, campo: keyof CompraRevisao, valor: string) {
    setCompras(cs => cs.map(c => {
      if (c.key !== key) return c
      const upd = { ...c, [campo]: valor }
      // editar um campo remove o alerta de confiança dele
      if (campo in (c.confianca ?? {})) upd.confianca = { ...c.confianca, [campo]: "alta" }
      return upd
    }))
  }
  function vincular(key: number, s: SugestaoCliente | null) {
    setCompras(cs => cs.map(c => c.key === key
      ? { ...c, clienteSel: s, ...(s ? { nome_cliente: s.nome, whatsapp: s.celular ?? c.whatsapp } : {}) }
      : c))
  }
  function remover(key: number) {
    setCompras(cs => cs.filter(c => c.key !== key))
  }
  function adicionarManual() {
    setCompras(cs => [...cs, {
      key: ++keyRef.current,
      nome_cliente: "", whatsapp: "", numero_sacola: "", cor_sacola: "",
      quantidade_itens: "", valor_total: "", observacao: "",
      confianca: {}, sugestoes: [], clienteSel: null,
    }])
  }

  // ── Salvamento em lote (uma a uma, com progresso) ──
  async function salvarTudo() {
    const pendentes = compras.filter(c => !c.salva)
    const invalidas = pendentes.filter(c => !c.nome_cliente.trim() || !c.valor_total.trim())
    if (invalidas.length > 0) {
      setErroMsg(`${invalidas.length} compra(s) sem nome ou valor. Complete os campos destacados.`)
      return
    }
    setErroMsg("")
    setFase("salvando")
    setProgresso({ atual: 0, total: pendentes.length, erros: 0 })

    let erros = 0
    for (let i = 0; i < pendentes.length; i++) {
      const c = pendentes[i]
      setProgresso(p => ({ ...p, atual: i + 1 }))
      try {
        const valor = inputParaNum(c.valor_total)
        const credito = c.clienteSel ? Math.min(Number(c.clienteSel.saldo_credito ?? 0), valor) : 0
        await apiPost(`/live/${liveId}/compras`, {
          cliente_id:       c.clienteSel?.id ?? undefined,
          nome_cliente:     c.nome_cliente.trim(),
          whatsapp:         c.whatsapp.trim() || undefined,
          data_compra:      liveData || undefined,
          cor_sacola:       c.cor_sacola || undefined,
          numero_sacola:    c.numero_sacola.trim() || undefined,
          quantidade_itens: parseInt(c.quantidade_itens) || 1,
          valor_total:      valor,
          desconto:         0,
          credito_aplicado: credito,
          observacao:       c.observacao.trim() || undefined,
          status_compra:    "cadastrada",
        })
        setCompras(cs => cs.map(x => x.key === c.key ? { ...x, salva: true, erroSalvar: undefined } : x))
      } catch (e) {
        erros++
        const msg = e instanceof Error ? e.message : "Erro ao salvar"
        setCompras(cs => cs.map(x => x.key === c.key ? { ...x, erroSalvar: msg } : x))
      }
    }
    setProgresso(p => ({ ...p, erros }))
    onSalvo()
    if (erros === 0) {
      setFase("concluido")
    } else {
      setErroMsg(`${erros} compra(s) não foram salvas. Revise os cards com erro e tente novamente.`)
      setFase("revisao")
    }
  }

  const salvas = compras.filter(c => c.salva).length
  const pendentes = compras.length - salvas

  // ── Estilos base ──
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", color: "var(--text-primary)" }
  const label = "text-[10px] font-bold uppercase tracking-wider mb-1 block"

  function bordaConfianca(c: CompraRevisao, campo: string, obrigatorio = false): { borderColor: string; borderWidth: number } {
    const vazio = !(c[campo as keyof CompraRevisao] as string)?.toString().trim()
    if (obrigatorio && vazio) return { borderColor: "#ef4444", borderWidth: 2 }
    const nivel = c.confianca?.[campo]
    if (!vazio && nivel === "baixa") return { borderColor: "#ef4444", borderWidth: 2 }
    if (!vazio && nivel === "media") return { borderColor: "#f59e0b", borderWidth: 2 }
    return { borderColor: "var(--border)", borderWidth: 1 }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--bg-base)" }}>

      {/* Inputs escondidos — câmera e galeria */}
      <input ref={inputCamera}  type="file" accept="image/*" capture="environment" className="hidden" onChange={aoEscolherArquivo}/>
      <input ref={inputGaleria} type="file" accept="image/*" className="hidden" onChange={aoEscolherArquivo}/>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="font-bold text-sm hidden sm:inline" style={{ color: COR_LIVE }}>Brechó Bellasu</span>
          <span className="hidden sm:inline" style={{ color: "var(--border)" }}>|</span>
          <Camera size={16} style={{ color: COR_LIVE }} className="sm:hidden shrink-0"/>
          <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>Importar por Foto</span>
        </div>
        {fase !== "processando" && fase !== "salvando" && (
          <button onClick={fecharSeguro} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg shrink-0" style={{ color: "var(--text-secondary)" }}>
            <X size={15}/> {fase === "concluido" ? "Fechar" : "Cancelar"}
          </button>
        )}
      </div>

      {/* ── Conteúdo ── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ════ FASE 1 — CAPTURA ════ */}
          {fase === "captura" && (
            <motion.div key="captura" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="min-h-full flex flex-col items-center justify-center px-4 py-8">
              <div className="w-full max-w-xl">

                {!imagem ? (
                  <>
                    <div className="text-center mb-8">
                      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                        className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                        style={{ background: `${COR_LIVE}18` }}>
                        <ScanLine size={30} style={{ color: COR_LIVE }}/>
                      </motion.div>
                      <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                        Foto do caderno
                      </h1>
                      <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
                        Tire uma foto da página com as anotações das compras. O sistema identifica clientes, sacolas e valores automaticamente.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
                        onClick={() => inputCamera.current?.click()}
                        className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl text-white"
                        style={{ background: `linear-gradient(135deg, ${COR_LIVE}, #9f1239)` }}>
                        <Camera size={32}/>
                        <div>
                          <p className="font-black uppercase tracking-wide text-sm">Tirar Foto Agora</p>
                          <p className="text-xs opacity-80 mt-0.5">Abre a câmera do dispositivo</p>
                        </div>
                      </motion.button>

                      <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
                        onClick={() => inputGaleria.current?.click()}
                        className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                        <ImageIcon size={32} style={{ color: COR_LIVE }}/>
                        <div>
                          <p className="font-black uppercase tracking-wide text-sm">Enviar da Galeria</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Escolher imagem já salva</p>
                        </div>
                      </motion.button>
                    </div>

                    <div className="mt-6 px-4 py-3 rounded-xl flex items-start gap-2.5"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                      <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: "#f59e0b" }}/>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        <strong style={{ color: "var(--text-secondary)" }}>Dica:</strong> boa iluminação, página inteira visível e sem sombras melhoram muito a leitura. Você revisa tudo antes de salvar.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold mb-1 text-center" style={{ color: "var(--text-primary)" }}>Confira a foto</h1>
                    <p className="text-sm mb-5 text-center" style={{ color: "var(--text-muted)" }}>A página está nítida e bem enquadrada?</p>
                    <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="rounded-2xl overflow-hidden mb-5" style={{ border: "1px solid var(--border)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagem} alt="Foto do caderno" className="w-full max-h-[45vh] object-contain" style={{ background: "#000" }}/>
                    </motion.div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setImagem(null)}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold uppercase tracking-wide"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        <RefreshCw size={15}/> Trocar Imagem
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={analisar}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-black uppercase tracking-wide text-white"
                        style={{ background: `linear-gradient(135deg, ${COR_LIVE}, #9f1239)` }}>
                        <Sparkles size={15}/> Analisar Foto
                      </motion.button>
                    </div>
                  </>
                )}

                {erroMsg && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="mt-4 text-sm text-center flex items-center justify-center gap-1.5" style={{ color: "#ef4444" }}>
                    <AlertTriangle size={14}/> {erroMsg}
                  </motion.p>
                )}
              </div>
            </motion.div>
          )}

          {/* ════ FASE 2 — PROCESSANDO ════ */}
          {fase === "processando" && (
            <motion.div key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="min-h-full flex flex-col items-center justify-center px-4 py-8">
              <div className="relative w-40 h-52 rounded-2xl overflow-hidden mb-8" style={{ border: "1px solid var(--border)" }}>
                {imagem && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagem} alt="" className="w-full h-full object-cover opacity-60"/>
                )}
                {/* linha de scan animada */}
                <motion.div
                  animate={{ top: ["0%", "92%", "0%"] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="absolute left-0 right-0 h-1 rounded-full"
                  style={{ background: COR_LIVE, boxShadow: `0 0 16px ${COR_LIVE}` }}/>
              </div>
              <AnimatePresence mode="wait">
                <motion.p key={msgIdx}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="text-base font-semibold text-center" style={{ color: "var(--text-primary)" }}>
                  {MSGS_PROCESSANDO[msgIdx]}
                </motion.p>
              </AnimatePresence>
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Isso leva alguns segundos...</p>
            </motion.div>
          )}

          {/* ════ FASE — ERRO DE LEITURA ════ */}
          {fase === "erro" && (
            <motion.div key="erro" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="min-h-full flex flex-col items-center justify-center px-4 py-8">
              <div className="w-full max-w-md text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "#ef444418" }}>
                  <XCircle size={30} style={{ color: "#ef4444" }}/>
                </div>
                <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Não consegui ler</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>{erroMsg}</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { setImagem(null); setErroMsg(""); setFase("captura") }}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-black uppercase tracking-wide text-white"
                    style={{ background: `linear-gradient(135deg, ${COR_LIVE}, #9f1239)` }}>
                    <Camera size={15}/> Tentar Outra Foto
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { setCompras([]); adicionarManual(); setErroMsg(""); setFase("revisao") }}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold uppercase tracking-wide"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    <Plus size={15}/> Preencher Manualmente
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════ FASE 3 — REVISÃO ════ */}
          {fase === "revisao" && (
            <motion.div key="rev" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="px-3 sm:px-6 py-5 pb-32 max-w-3xl mx-auto">

              {/* Cabeçalho da revisão */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={18} style={{ color: "#22c55e" }}/>
                  <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {compras.length} compra{compras.length !== 1 ? "s" : ""} encontrada{compras.length !== 1 ? "s" : ""}
                  </h1>
                </div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Revise e corrija antes de salvar. Nada é salvo sem a sua confirmação.
                </p>
                {/* Legenda de confiança */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <span className="w-3 h-3 rounded border-2" style={{ borderColor: "#f59e0b" }}/> leitura duvidosa — confira
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <span className="w-3 h-3 rounded border-2" style={{ borderColor: "#ef4444" }}/> precisa preencher / revisar
                  </span>
                </div>
              </div>

              {/* Cards das compras */}
              <div className="space-y-4">
                <AnimatePresence>
                  {compras.map((c, idx) => (
                    <motion.div key={c.key} layout
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, height: 0, marginBottom: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="rounded-2xl p-4 relative"
                      style={{
                        background: "var(--bg-surface)",
                        border: c.salva ? "1px solid #22c55e" : c.erroSalvar ? "1.5px solid #ef4444" : "1px solid var(--border)",
                        opacity: c.salva ? 0.65 : 1,
                      }}>

                      {/* Header do card */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 text-white"
                            style={{ background: c.salva ? "#22c55e" : COR_LIVE }}>
                            {c.salva ? <Check size={12}/> : idx + 1}
                          </span>
                          {/* Badge de vínculo */}
                          {c.clienteSel ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full truncate"
                              style={{ background: "#22c55e1a", color: "#16a34a" }}>
                              <UserCheck size={11} className="shrink-0"/>
                              <span className="truncate">Cliente encontrada</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full"
                              style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
                              <UserPlus size={11}/> Sem vínculo
                            </span>
                          )}
                        </div>
                        {!c.salva && (
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                            onClick={() => remover(c.key)}
                            className="p-1.5 rounded-lg shrink-0" style={{ color: "#ef4444" }}
                            title="Remover esta compra">
                            <Trash2 size={15}/>
                          </motion.button>
                        )}
                      </div>

                      {/* Sugestões de cliente */}
                      {!c.salva && c.sugestoes.length > 0 && !c.clienteSel && (
                        <div className="mb-3 p-3 rounded-xl" style={{ background: "#f59e0b12", border: "1px dashed #f59e0b66" }}>
                          <p className="text-[11px] font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "#d97706" }}>
                            <UserCheck size={12}/> Cliente parecida no cadastro — é uma destas?
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {c.sugestoes.map(s => (
                              <motion.button key={s.id} whileTap={{ scale: 0.95 }}
                                onClick={() => vincular(c.key, s)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                                style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                                  style={{ background: `${COR_LIVE}18`, color: COR_LIVE }}>{s.nome[0]}</span>
                                <span className="uppercase">{s.nome}</span>
                                {s.instagram && <span style={{ color: "var(--text-muted)" }}>@{s.instagram.replace(/^@/, "")}</span>}
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cliente vinculada — detalhes + desfazer */}
                      {!c.salva && c.clienteSel && (
                        <div className="mb-3 px-3 py-2 rounded-xl flex items-center justify-between gap-2 flex-wrap"
                          style={{ background: "#22c55e10", border: "1px solid #22c55e44" }}>
                          <div className="flex items-center gap-2 text-xs min-w-0" style={{ color: "#16a34a" }}>
                            <Check size={13} className="shrink-0"/>
                            <span className="font-bold uppercase truncate">{c.clienteSel.nome}</span>
                            {c.clienteSel.celular && <span className="opacity-80">{c.clienteSel.celular}</span>}
                            {c.clienteSel.saldo_credito > 0 && (
                              <span className="flex items-center gap-1 font-bold shrink-0" style={{ color: "#d97706" }}>
                                <Wallet size={12}/> Crédito {fmtBRL(Math.min(c.clienteSel.saldo_credito, inputParaNum(c.valor_total) || c.clienteSel.saldo_credito))} será abatido
                              </span>
                            )}
                          </div>
                          <button onClick={() => vincular(c.key, null)} className="text-[11px] font-semibold underline shrink-0" style={{ color: "var(--text-muted)" }}>
                            desfazer
                          </button>
                        </div>
                      )}

                      {/* Campos editáveis */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="col-span-2">
                          <span className={label} style={{ color: "var(--text-muted)" }}>Nome da Cliente *</span>
                          <input value={c.nome_cliente} disabled={c.salva}
                            onChange={e => setCampo(c.key, "nome_cliente", e.target.value)}
                            placeholder="Obrigatório"
                            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none uppercase"
                            style={{ ...iSt, borderStyle: "solid", ...bordaConfianca(c, "nome_cliente", true) }}/>
                        </div>
                        <div className="col-span-2">
                          <span className={label} style={{ color: "var(--text-muted)" }}>WhatsApp</span>
                          <input value={c.whatsapp} disabled={c.salva}
                            onChange={e => setCampo(c.key, "whatsapp", e.target.value)}
                            placeholder="(16) 99999-9999"
                            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                            style={{ ...iSt, borderStyle: "solid", ...bordaConfianca(c, "whatsapp") }}/>
                        </div>
                        <div>
                          <span className={label} style={{ color: "var(--text-muted)" }}>Nº Sacola</span>
                          <input value={c.numero_sacola} disabled={c.salva}
                            onChange={e => setCampo(c.key, "numero_sacola", e.target.value)}
                            placeholder="—" inputMode="numeric"
                            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                            style={{ ...iSt, borderStyle: "solid", ...bordaConfianca(c, "numero_sacola") }}/>
                        </div>
                        <div>
                          <span className={label} style={{ color: "var(--text-muted)" }}>Cor Sacola</span>
                          <div className="relative">
                            <select value={c.cor_sacola} disabled={c.salva}
                              onChange={e => setCampo(c.key, "cor_sacola", e.target.value)}
                              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none appearance-none pr-7"
                              style={{ ...iSt, borderStyle: "solid", ...bordaConfianca(c, "cor_sacola") }}>
                              <option value="">—</option>
                              {CORES_SACOLA.map(cor => <option key={cor} value={cor}>{cor}</option>)}
                              {c.cor_sacola && !CORES_SACOLA.includes(c.cor_sacola) && (
                                <option value={c.cor_sacola}>{c.cor_sacola}</option>
                              )}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}/>
                          </div>
                        </div>
                        <div>
                          <span className={label} style={{ color: "var(--text-muted)" }}>Qtd. Itens</span>
                          <input value={c.quantidade_itens} disabled={c.salva}
                            onChange={e => setCampo(c.key, "quantidade_itens", e.target.value.replace(/\D/g, ""))}
                            placeholder="1" inputMode="numeric"
                            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                            style={{ ...iSt, borderStyle: "solid", ...bordaConfianca(c, "quantidade_itens") }}/>
                        </div>
                        <div>
                          <span className={label} style={{ color: "var(--text-muted)" }}>Valor Total *</span>
                          <input value={c.valor_total} disabled={c.salva}
                            onChange={e => setCampo(c.key, "valor_total", e.target.value.replace(/[^\d.,]/g, ""))}
                            placeholder="0,00" inputMode="decimal"
                            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none font-semibold"
                            style={{ ...iSt, borderStyle: "solid", ...bordaConfianca(c, "valor_total", true) }}/>
                        </div>
                        <div className="col-span-2 sm:col-span-4">
                          <span className={label} style={{ color: "var(--text-muted)" }}>Observações</span>
                          <input value={c.observacao} disabled={c.salva}
                            onChange={e => setCampo(c.key, "observacao", e.target.value)}
                            placeholder="Opcional"
                            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                            style={{ ...iSt, border: "1px solid var(--border)" }}/>
                        </div>
                      </div>

                      {/* Alertas de campos duvidosos */}
                      {!c.salva && Object.values(c.confianca ?? {}).some(n => n !== "alta") && (
                        <p className="mt-2.5 text-[11px] flex items-center gap-1.5" style={{ color: "#d97706" }}>
                          <AlertTriangle size={12} className="shrink-0"/>
                          Alguns campos ficaram com leitura duvidosa — confira os destacados.
                        </p>
                      )}
                      {c.erroSalvar && (
                        <p className="mt-2.5 text-[11px] flex items-center gap-1.5 font-semibold" style={{ color: "#ef4444" }}>
                          <XCircle size={12} className="shrink-0"/> {c.erroSalvar}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Adicionar manual */}
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={adicionarManual}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold uppercase tracking-wide"
                style={{ background: "transparent", border: "1.5px dashed var(--border)", color: "var(--text-muted)" }}>
                <Plus size={15}/> Adicionar compra que faltou
              </motion.button>

              {/* Footer fixo de confirmação */}
              <div className="fixed bottom-0 left-0 right-0 px-3 sm:px-6 py-3 sm:py-4"
                style={{ background: "var(--bg-base)", borderTop: "1px solid var(--border)", boxShadow: "0 -8px 24px rgba(0,0,0,0.12)" }}>
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                  {erroMsg ? (
                    <p className="flex-1 text-xs font-semibold flex items-center gap-1.5 min-w-0" style={{ color: "#ef4444" }}>
                      <AlertTriangle size={13} className="shrink-0"/> <span className="truncate">{erroMsg}</span>
                    </p>
                  ) : (
                    <p className="flex-1 text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>
                      {salvas > 0 && <span style={{ color: "#16a34a", fontWeight: 700 }}>{salvas} salva{salvas !== 1 ? "s" : ""} · </span>}
                      Confira os dados antes de confirmar.
                    </p>
                  )}
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={salvarTudo} disabled={pendentes === 0}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wide text-white w-full sm:w-auto"
                    style={{
                      background: pendentes === 0 ? "var(--border)" : "linear-gradient(135deg, #22c55e, #15803d)",
                      opacity: pendentes === 0 ? 0.6 : 1,
                    }}>
                    <Check size={15}/> Salvar {pendentes} Compra{pendentes !== 1 ? "s" : ""}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════ FASE 4 — SALVANDO ════ */}
          {fase === "salvando" && (
            <motion.div key="salv" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="min-h-full flex flex-col items-center justify-center px-4 py-8">
              <Loader2 size={36} className="animate-spin mb-5" style={{ color: COR_LIVE }}/>
              <p className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Salvando compra {progresso.atual} de {progresso.total}...
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Não feche esta tela.</p>
              <div className="w-56 h-1.5 rounded-full mt-5 overflow-hidden" style={{ background: "var(--border)" }}>
                <motion.div className="h-full rounded-full"
                  animate={{ width: `${(progresso.atual / Math.max(1, progresso.total)) * 100}%` }}
                  style={{ background: "#22c55e" }}/>
              </div>
            </motion.div>
          )}

          {/* ════ FASE 5 — CONCLUÍDO ════ */}
          {fase === "concluido" && (
            <motion.div key="ok" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="min-h-full flex flex-col items-center justify-center px-4 py-8">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}
                className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
                style={{ background: "#22c55e1a" }}>
                <CheckCircle2 size={42} style={{ color: "#22c55e" }}/>
              </motion.div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Tudo salvo!</h1>
              <p className="text-sm mb-8 text-center max-w-xs" style={{ color: "var(--text-muted)" }}>
                {progresso.total} compra{progresso.total !== 1 ? "s foram salvas" : " foi salva"} na live. Agora você pode vincular os produtos de cada uma.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { setImagem(null); setCompras([]); setErroMsg(""); setFase("captura") }}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <Camera size={15}/> Importar Outra Página
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wide text-white"
                  style={{ background: `linear-gradient(135deg, ${COR_LIVE}, #9f1239)` }}>
                  <Check size={15}/> Concluir
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  )
}
