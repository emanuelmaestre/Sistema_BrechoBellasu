"use client"

// ══════════════════════════════════════════════════════════
// Importar Clientes por Foto — envia prints de WhatsApp /
// Instagram com dados cadastrais, a IA extrai os campos e o
// usuário revisa tudo antes de salvar. Nada é salvo sem
// confirmação. Espelha o padrão do ImportarPorFoto da Live.
// ══════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  X, Camera, ImageIcon, Sparkles, Trash2, Check,
  AlertTriangle, UserCheck, Loader2,
  CheckCircle2, XCircle, Plus, ScanLine, UserPlus,
} from "lucide-react"
import { apiPost } from "@/services/api"

// ─── Tipos ────────────────────────────────────────────────
type NivelConfianca = "alta" | "media" | "baixa"

interface SugestaoCliente {
  id: number
  nome: string
  celular: string | null
  instagram: string | null
  match: "exato" | "parecido"
}

interface ClienteLido {
  nome: string | null
  apelido: string | null
  cpf_cnpj: string | null
  data_nasc: string | null
  celular: string | null
  instagram: string | null
  email: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  observacao_leitura: string | null
  confianca: Record<string, NivelConfianca>
  sugestoes: SugestaoCliente[]
}

interface RespostaAnalise {
  legivel: boolean
  motivo: string | null
  clientes: ClienteLido[]
}

// Estado editável de cada cliente na tela de revisão
interface ClienteRevisao {
  key: number
  nome: string
  apelido: string
  cpf_cnpj: string
  data_nasc: string
  celular: string
  instagram: string
  email: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  observacao_leitura: string
  confianca: Record<string, NivelConfianca>
  sugestoes: SugestaoCliente[]
  erroSalvar?: string
  salva?: boolean
}

type Fase = "captura" | "processando" | "revisao" | "salvando" | "concluido" | "erro"

const COR = "#3b82f6"
const COR_ESCURA = "#1d4ed8"
const MAX_PRINTS = 4

const MSGS_PROCESSANDO = [
  "Lendo os prints enviados...",
  "Identificando nome, WhatsApp e endereço...",
  "Separando cada dado no campo certo...",
  "Conferindo se a cliente já está cadastrada...",
]

// ─── Compressão da imagem no cliente ──────────────────────
// Prints de celular chegam grandes; reduz para ~2000px JPEG
// (texto de tela se mantém legível para a IA nessa resolução).
async function comprimirImagem(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error("Não foi possível ler a imagem"))
      i.src = url
    })
    const MAX = 2000
    const scale = Math.min(1, MAX / Math.max(img.width, img.height))
    const canvas = document.createElement("canvas")
    canvas.width  = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas indisponível")
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.88)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ─── Componente principal ─────────────────────────────────
export default function ImportarClientePorFoto({ onClose, onSalvo }: {
  onClose: () => void
  onSalvo: () => void
}) {
  const [fase, setFase]         = useState<Fase>("captura")
  const [imagens, setImagens]   = useState<string[]>([])
  const [erroMsg, setErroMsg]   = useState("")
  const [msgIdx, setMsgIdx]     = useState(0)
  const [clientes, setClientes] = useState<ClienteRevisao[]>([])
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, erros: 0 })

  const inputCamera  = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)
  const keyRef = useRef(0)

  // Fecha com segurança: na revisão com dados não salvos, pede confirmação
  const fecharSeguro = useCallback(() => {
    if (fase === "processando" || fase === "salvando") return
    if (fase === "revisao" && clientes.some(c => !c.salva)) {
      if (!window.confirm("Descartar os cadastros que ainda não foram salvos?")) return
    }
    onClose()
  }, [fase, clientes, onClose])

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

  // ── Seleção de arquivos (aceita vários de uma vez) ──
  async function aoEscolherArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = "" // permite escolher o mesmo arquivo de novo
    if (files.length === 0) return
    const soImagens = files.filter(f => f.type.startsWith("image/"))
    if (soImagens.length === 0) { setErroMsg("Escolha arquivos de imagem."); return }
    try {
      const novas: string[] = []
      for (const f of soImagens) novas.push(await comprimirImagem(f))
      setImagens(prev => {
        const juntas = [...prev, ...novas]
        if (juntas.length > MAX_PRINTS) setErroMsg(`Máximo de ${MAX_PRINTS} prints por análise — os extras foram ignorados.`)
        else setErroMsg("")
        return juntas.slice(0, MAX_PRINTS)
      })
    } catch {
      setErroMsg("Não foi possível ler uma das imagens. Tente outra.")
    }
  }

  function removerImagem(idx: number) {
    setImagens(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Envia para análise ──
  const analisar = useCallback(async () => {
    if (imagens.length === 0) return
    setMsgIdx(0)
    setFase("processando")
    setErroMsg("")
    try {
      const res = await apiPost<RespostaAnalise>("/clientes/importar-foto", { imagens })
      if (!res.legivel || res.clientes.length === 0) {
        setErroMsg(res.motivo ?? "Não encontrei dados cadastrais nestes prints.")
        setFase("erro")
        return
      }
      setClientes(res.clientes.map(c => ({
        key: ++keyRef.current,
        nome:        c.nome ?? "",
        apelido:     c.apelido ?? "",
        cpf_cnpj:    c.cpf_cnpj ?? "",
        data_nasc:   c.data_nasc ?? "",
        celular:     c.celular ?? "",
        instagram:   c.instagram ?? "",
        email:       c.email ?? "",
        cep:         c.cep ?? "",
        logradouro:  c.logradouro ?? "",
        numero:      c.numero ?? "",
        complemento: c.complemento ?? "",
        bairro:      c.bairro ?? "",
        cidade:      c.cidade ?? "",
        estado:      c.estado ?? "",
        observacao_leitura: c.observacao_leitura ?? "",
        confianca:   c.confianca ?? {},
        sugestoes:   c.sugestoes ?? [],
      })))
      setFase("revisao")
    } catch (e) {
      setErroMsg(e instanceof Error ? e.message : "Erro ao analisar os prints.")
      setFase("erro")
    }
  }, [imagens])

  // ── Edição na revisão ──
  function setCampo(key: number, campo: keyof ClienteRevisao, valor: string) {
    setClientes(cs => cs.map(c => {
      if (c.key !== key) return c
      const upd = { ...c, [campo]: valor }
      // editar um campo remove o alerta de confiança dele
      if (campo in (c.confianca ?? {})) upd.confianca = { ...c.confianca, [campo]: "alta" }
      return upd
    }))
  }
  function remover(key: number) {
    setClientes(cs => cs.filter(c => c.key !== key))
  }
  function adicionarManual() {
    setClientes(cs => [...cs, {
      key: ++keyRef.current,
      nome: "", apelido: "", cpf_cnpj: "", data_nasc: "", celular: "",
      instagram: "", email: "", cep: "", logradouro: "", numero: "",
      complemento: "", bairro: "", cidade: "", estado: "",
      observacao_leitura: "", confianca: {}, sugestoes: [],
    }])
  }

  // ── Salvamento em lote (um a um, com progresso) ──
  async function salvarTudo() {
    const pendentes = clientes.filter(c => !c.salva)
    const invalidos = pendentes.filter(c => !c.nome.trim())
    if (invalidos.length > 0) {
      setErroMsg(`${invalidos.length} cadastro(s) sem nome. Complete os campos destacados.`)
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
        await apiPost("/clientes", {
          nome:        c.nome.trim(),
          apelido:     c.apelido.trim() || undefined,
          cpf_cnpj:    c.cpf_cnpj.trim() || undefined,
          data_nasc:   c.data_nasc.trim() || undefined,
          celular:     c.celular.replace(/\D/g, "") || undefined,
          instagram:   c.instagram.trim().replace(/^@/, "") || undefined,
          email:       c.email.trim() || undefined,
          cep:         c.cep.trim() || undefined,
          logradouro:  c.logradouro.trim() || undefined,
          numero:      c.numero.trim() || undefined,
          complemento: c.complemento.trim() || undefined,
          bairro:      c.bairro.trim() || undefined,
          cidade:      c.cidade.trim() || undefined,
          estado:      c.estado.trim() || undefined,
        })
        setClientes(cs => cs.map(x => x.key === c.key ? { ...x, salva: true, erroSalvar: undefined } : x))
      } catch (e) {
        erros++
        const msg = e instanceof Error ? e.message : "Erro ao salvar"
        setClientes(cs => cs.map(x => x.key === c.key ? { ...x, erroSalvar: msg } : x))
      }
    }
    setProgresso(p => ({ ...p, erros }))
    onSalvo()
    if (erros === 0) {
      setFase("concluido")
    } else {
      setErroMsg(`${erros} cadastro(s) não foram salvos. Revise os cards com erro e tente novamente.`)
      setFase("revisao")
    }
  }

  const salvos = clientes.filter(c => c.salva).length
  const pendentes = clientes.length - salvos

  // ── Estilos base ──
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", color: "var(--text-primary)" }
  const label = "text-[10px] font-bold uppercase tracking-wider mb-1 block"

  function bordaConfianca(c: ClienteRevisao, campo: string, obrigatorio = false): { borderColor: string; borderWidth: number } {
    const vazio = !(c[campo as keyof ClienteRevisao] as string)?.toString().trim()
    if (obrigatorio && vazio) return { borderColor: "#ef4444", borderWidth: 2 }
    const nivel = c.confianca?.[campo]
    if (!vazio && nivel === "baixa") return { borderColor: "#ef4444", borderWidth: 2 }
    if (!vazio && nivel === "media") return { borderColor: "#f59e0b", borderWidth: 2 }
    return { borderColor: "var(--border)", borderWidth: 1 }
  }

  function campoInput(c: ClienteRevisao, campo: keyof ClienteRevisao, titulo: string, opts?: {
    obrigatorio?: boolean; placeholder?: string; span?: string; inputMode?: "numeric" | "decimal" | "email"; tipo?: string; upper?: boolean
  }) {
    return (
      <div className={opts?.span ?? ""}>
        <span className={label} style={{ color: "var(--text-muted)" }}>{titulo}{opts?.obrigatorio ? " *" : ""}</span>
        <input value={c[campo] as string} disabled={c.salva}
          type={opts?.tipo ?? "text"}
          onChange={e => setCampo(c.key, campo, e.target.value)}
          placeholder={opts?.placeholder ?? "—"}
          inputMode={opts?.inputMode}
          className={`w-full px-3 py-2.5 text-sm rounded-xl outline-none ${opts?.upper ? "uppercase" : ""}`}
          style={{ ...iSt, borderStyle: "solid", ...bordaConfianca(c, campo, opts?.obrigatorio) }}/>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--bg-base)" }}>

      {/* Inputs escondidos — câmera e galeria (galeria aceita vários) */}
      <input ref={inputCamera}  type="file" accept="image/*" capture="environment" className="hidden" onChange={aoEscolherArquivos}/>
      <input ref={inputGaleria} type="file" accept="image/*" multiple className="hidden" onChange={aoEscolherArquivos}/>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="font-bold text-sm hidden sm:inline" style={{ color: COR }}>Brechó Bellasu</span>
          <span className="hidden sm:inline" style={{ color: "var(--border)" }}>|</span>
          <Camera size={16} style={{ color: COR }} className="sm:hidden shrink-0"/>
          <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>Importar Clientes por Foto</span>
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

                {imagens.length === 0 ? (
                  <>
                    <div className="text-center mb-8">
                      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                        className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                        style={{ background: `${COR}18` }}>
                        <ScanLine size={30} style={{ color: COR }}/>
                      </motion.div>
                      <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                        Prints com dados da cliente
                      </h1>
                      <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
                        Envie prints do WhatsApp ou Instagram com os dados cadastrais (nome, telefone, endereço...). O sistema lê e preenche o cadastro para você revisar.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
                        onClick={() => inputCamera.current?.click()}
                        className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl text-white"
                        style={{ background: `linear-gradient(135deg, ${COR}, ${COR_ESCURA})` }}>
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
                        <ImageIcon size={32} style={{ color: COR }}/>
                        <div>
                          <p className="font-black uppercase tracking-wide text-sm">Enviar da Galeria</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Pode escolher vários prints</p>
                        </div>
                      </motion.button>
                    </div>

                    <div className="mt-6 px-4 py-3 rounded-xl flex items-start gap-2.5"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                      <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: "#f59e0b" }}/>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        <strong style={{ color: "var(--text-secondary)" }}>Dica:</strong> você pode enviar até {MAX_PRINTS} prints de uma vez — por exemplo, o perfil do WhatsApp e a mensagem com o endereço. Prints da mesma pessoa viram um único cadastro. Você revisa tudo antes de salvar.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold mb-1 text-center" style={{ color: "var(--text-primary)" }}>
                      {imagens.length} print{imagens.length !== 1 ? "s" : ""} selecionado{imagens.length !== 1 ? "s" : ""}
                    </h1>
                    <p className="text-sm mb-5 text-center" style={{ color: "var(--text-muted)" }}>Os dados estão legíveis nas capturas?</p>

                    <div className={`grid gap-3 mb-5 ${imagens.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                      {imagens.map((img, idx) => (
                        <motion.div key={idx} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="relative rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img} alt={`Print ${idx + 1}`} className="w-full max-h-[38vh] object-contain" style={{ background: "#000" }}/>
                          <button onClick={() => removerImagem(idx)}
                            className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-white"
                            style={{ background: "rgba(0,0,0,0.65)" }} title="Remover este print">
                            <X size={15}/>
                          </button>
                        </motion.div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      {imagens.length < MAX_PRINTS && (
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                          onClick={() => inputGaleria.current?.click()}
                          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold uppercase tracking-wide"
                          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                          <Plus size={15}/> Adicionar Print
                        </motion.button>
                      )}
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={analisar}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-black uppercase tracking-wide text-white"
                        style={{ background: `linear-gradient(135deg, ${COR}, ${COR_ESCURA})` }}>
                        <Sparkles size={15}/> Analisar Print{imagens.length !== 1 ? "s" : ""}
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
                {imagens[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagens[0]} alt="" className="w-full h-full object-cover opacity-60"/>
                )}
                {/* linha de scan animada */}
                <motion.div
                  animate={{ top: ["0%", "92%", "0%"] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="absolute left-0 right-0 h-1 rounded-full"
                  style={{ background: COR, boxShadow: `0 0 16px ${COR}` }}/>
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
                    onClick={() => { setImagens([]); setErroMsg(""); setFase("captura") }}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-black uppercase tracking-wide text-white"
                    style={{ background: `linear-gradient(135deg, ${COR}, ${COR_ESCURA})` }}>
                    <Camera size={15}/> Tentar Outros Prints
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { setClientes([]); adicionarManual(); setErroMsg(""); setFase("revisao") }}
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
                    {clientes.length} cadastro{clientes.length !== 1 ? "s" : ""} encontrado{clientes.length !== 1 ? "s" : ""}
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

              {/* Cards dos cadastros */}
              <div className="space-y-4">
                <AnimatePresence>
                  {clientes.map((c, idx) => {
                    const jaCadastrada = c.sugestoes.find(s => s.match === "exato")
                    const parecidas    = c.sugestoes.filter(s => s.match === "parecido")
                    return (
                    <motion.div key={c.key} layout
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, height: 0, marginBottom: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="rounded-2xl p-4 relative"
                      style={{
                        background: "var(--bg-surface)",
                        border: c.salva ? "1px solid #22c55e" : c.erroSalvar ? "1.5px solid #ef4444" : jaCadastrada ? "1.5px solid #f59e0b" : "1px solid var(--border)",
                        opacity: c.salva ? 0.65 : 1,
                      }}>

                      {/* Header do card */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 text-white"
                            style={{ background: c.salva ? "#22c55e" : COR }}>
                            {c.salva ? <Check size={12}/> : idx + 1}
                          </span>
                          {jaCadastrada && !c.salva ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full truncate"
                              style={{ background: "#f59e0b1a", color: "#d97706" }}>
                              <AlertTriangle size={11} className="shrink-0"/>
                              <span className="truncate">Já cadastrada</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full"
                              style={{ background: `${COR}14`, color: COR }}>
                              <UserPlus size={11}/> Novo cadastro
                            </span>
                          )}
                        </div>
                        {!c.salva && (
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                            onClick={() => remover(c.key)}
                            className="p-1.5 rounded-lg shrink-0" style={{ color: "#ef4444" }}
                            title="Remover este cadastro">
                            <Trash2 size={15}/>
                          </motion.button>
                        )}
                      </div>

                      {/* Aviso: cliente já existe (celular/@ idêntico) */}
                      {!c.salva && jaCadastrada && (
                        <div className="mb-3 px-3 py-2.5 rounded-xl"
                          style={{ background: "#f59e0b12", border: "1px dashed #f59e0b88" }}>
                          <p className="text-xs font-semibold flex items-center gap-1.5 flex-wrap" style={{ color: "#d97706" }}>
                            <UserCheck size={13} className="shrink-0"/>
                            <span className="uppercase">{jaCadastrada.nome}</span> já está no sistema
                            {jaCadastrada.celular && <span className="opacity-80">({jaCadastrada.celular})</span>}
                            — remova este card para não duplicar.
                          </p>
                        </div>
                      )}

                      {/* Aviso: nomes parecidos no cadastro */}
                      {!c.salva && !jaCadastrada && parecidas.length > 0 && (
                        <div className="mb-3 px-3 py-2.5 rounded-xl"
                          style={{ background: "var(--bg-hover)", border: "1px dashed var(--border)" }}>
                          <p className="text-[11px] flex items-center gap-1.5 flex-wrap" style={{ color: "var(--text-muted)" }}>
                            <AlertTriangle size={12} className="shrink-0" style={{ color: "#f59e0b" }}/>
                            Nome parecido já cadastrado:{" "}
                            <strong className="uppercase" style={{ color: "var(--text-secondary)" }}>
                              {parecidas.map(s => s.nome).join(", ")}
                            </strong>
                            — confira se não é a mesma pessoa.
                          </p>
                        </div>
                      )}

                      {/* Campos — identificação */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {campoInput(c, "nome",      "Nome Completo", { obrigatorio: true, placeholder: "Obrigatório", span: "col-span-2 sm:col-span-3", upper: true })}
                        {campoInput(c, "apelido",   "Apelido")}
                        {campoInput(c, "celular",   "WhatsApp",      { placeholder: "16999999999", inputMode: "numeric", span: "col-span-2 sm:col-span-1" })}
                        {campoInput(c, "instagram", "Instagram",     { placeholder: "usuario", span: "col-span-2 sm:col-span-1" })}
                        {campoInput(c, "cpf_cnpj",  "CPF",           { placeholder: "Somente números", inputMode: "numeric" })}
                        {campoInput(c, "data_nasc", "Nascimento",    { tipo: "date" })}
                        {campoInput(c, "email",     "E-mail",        { placeholder: "email@exemplo.com", inputMode: "email", span: "col-span-2 sm:col-span-4" })}
                      </div>

                      {/* Campos — endereço */}
                      <p className="text-[10px] font-bold uppercase tracking-wider mt-4 mb-2" style={{ color: "var(--text-muted)" }}>Endereço</p>
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                        {campoInput(c, "cep",         "CEP",         { placeholder: "00000000", inputMode: "numeric" })}
                        {campoInput(c, "logradouro",  "Rua / Av.",   { span: "col-span-2 sm:col-span-3" })}
                        {campoInput(c, "numero",      "Número")}
                        {campoInput(c, "complemento", "Complemento")}
                        {campoInput(c, "bairro",      "Bairro",      { span: "sm:col-span-2" })}
                        {campoInput(c, "cidade",      "Cidade",      { span: "sm:col-span-2" })}
                        {campoInput(c, "estado",      "UF",          { placeholder: "SP", upper: true })}
                      </div>

                      {/* Observação da leitura (dado que não coube nos campos) */}
                      {c.observacao_leitura && !c.salva && (
                        <p className="mt-2.5 text-[11px] flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                          <Sparkles size={12} className="shrink-0" style={{ color: "#f59e0b" }}/>
                          A leitura também encontrou: {c.observacao_leitura}
                        </p>
                      )}

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
                  )})}
                </AnimatePresence>
              </div>

              {/* Adicionar manual */}
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={adicionarManual}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold uppercase tracking-wide"
                style={{ background: "transparent", border: "1.5px dashed var(--border)", color: "var(--text-muted)" }}>
                <Plus size={15}/> Adicionar cadastro que faltou
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
                      {salvos > 0 && <span style={{ color: "#16a34a", fontWeight: 700 }}>{salvos} salvo{salvos !== 1 ? "s" : ""} · </span>}
                      Confira os dados antes de confirmar. Clientes com WhatsApp recebem a mensagem de consentimento automaticamente.
                    </p>
                  )}
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={salvarTudo} disabled={pendentes === 0}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wide text-white w-full sm:w-auto"
                    style={{
                      background: pendentes === 0 ? "var(--border)" : "linear-gradient(135deg, #22c55e, #15803d)",
                      opacity: pendentes === 0 ? 0.6 : 1,
                    }}>
                    <Check size={15}/> Salvar {pendentes} Cadastro{pendentes !== 1 ? "s" : ""}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════ FASE 4 — SALVANDO ════ */}
          {fase === "salvando" && (
            <motion.div key="salv" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="min-h-full flex flex-col items-center justify-center px-4 py-8">
              <Loader2 size={36} className="animate-spin mb-5" style={{ color: COR }}/>
              <p className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Salvando cadastro {progresso.atual} de {progresso.total}...
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
                {progresso.total} cliente{progresso.total !== 1 ? "s foram cadastrados" : " foi cadastrado"}. Quem tem WhatsApp já recebe a mensagem de consentimento automaticamente.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { setImagens([]); setClientes([]); setErroMsg(""); setFase("captura") }}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <Camera size={15}/> Importar Outros Prints
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wide text-white"
                  style={{ background: `linear-gradient(135deg, ${COR}, ${COR_ESCURA})` }}>
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
