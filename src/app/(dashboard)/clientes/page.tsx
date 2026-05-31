"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "motion/react"
import {
  Plus, Search, UserX, UserCheck, Pencil, Loader2,
  X, ChevronLeft, ArrowRight, Check, MapPin, AlertCircle, CalendarDays,
  Phone, AtSign, FileText, Home, Power,
} from "lucide-react"
import { apiGet, apiPost, apiPut, apiPatch } from "@/services/api"
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
}

const EMPTY: ClienteForm = {
  nome: "", apelido: "", cpf_cnpj: "", data_nasc: "", celular: "", instagram: "",
  cep: "", logradouro: "", numero: "",
  complemento: "", bairro: "", cidade: "", estado: "",
}

// ─── Animação de slide ────────────────────────────────────
const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
}

type CepStatus = "idle" | "buscando" | "encontrado" | "invalido" | "manual"

// ─── Confete ──────────────────────────────────────────────
const CONFETE_CORES = ["#a78bfa","#6366f1","#34d399","#f472b6","#fbbf24","#60a5fa","#f0abfc","#4ade80"]

function Confete({ show }: { show: boolean }) {
  if (!show) return null
  const pieces = Array.from({ length: 48 }, (_, i) => {
    const angle  = (i / 48) * 360
    const dist   = 120 + Math.random() * 180
    const rad    = (angle * Math.PI) / 180
    const tx     = Math.cos(rad) * dist
    const ty     = Math.sin(rad) * dist - 80
    const rotate = Math.random() * 720 - 360
    const cor    = CONFETE_CORES[i % CONFETE_CORES.length]
    const size   = 6 + Math.random() * 8
    const shape  = i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0%"
    return { tx, ty, rotate, cor, size, shape, delay: Math.random() * 0.15 }
  })

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
      {pieces.map((p, i) => (
        <motion.div key={i}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{ opacity: 0, x: p.tx, y: p.ty, rotate: p.rotate, scale: 0.3 }}
          transition={{ duration: 0.9 + Math.random() * 0.4, delay: p.delay, ease: [0.2, 0, 0.8, 1] }}
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
function DrawerCliente({
  cliente, onClose, onEditar, onToggleStatus,
}: {
  cliente: Cliente
  onClose: () => void
  onEditar: () => void
  onToggleStatus: () => void
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

  const INFO = [
    { icon: <Phone size={14} />,     label: "WhatsApp",   value: cliente.celular   ?? "—" },
    { icon: <AtSign size={14} />,    label: "Instagram",  value: cliente.instagram ? `@${cliente.instagram}` : "—" },
    { icon: <FileText size={14} />,  label: "CPF / CNPJ", value: cliente.cpf_cnpj  ?? "—" },
    { icon: <CalendarDays size={14} />, label: "Nascimento", value: cliente.data_nasc ? fmtData(cliente.data_nasc) : "—" },
    { icon: <Home size={14} />,      label: "Endereço",   value: endereco || "—", full: true },
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Painel lateral */}
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="relative w-full max-w-sm flex flex-col shadow-2xl"
        style={{ background: "var(--bg-card)", borderLeft: "1px solid var(--border)" }}>

        {/* Topo colorido */}
        <div className="px-6 pt-8 pb-6 shrink-0" style={{ background: "linear-gradient(135deg, var(--accent-bg) 0%, transparent 100%)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-start justify-between mb-5">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 280 }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black"
              style={{ background: "var(--accent)", color: "#fff" }}>
              {inicial}
            </motion.div>
            <button onClick={onClose}
              className="p-1.5 rounded-xl transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
              <X size={16} />
            </button>
          </div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <p className="text-lg font-bold uppercase leading-tight" style={{ color: "var(--text-primary)" }}>{cliente.nome}</p>
            {cliente.apelido && (
              <p className="text-sm mt-0.5 font-medium" style={{ color: "var(--accent)" }}>&ldquo;{cliente.apelido}&rdquo;</p>
            )}
            <span className={cn(
              "inline-block mt-2 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase",
              cliente.ativo ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"
            )}>
              {cliente.ativo ? "● Ativo" : "● Inativo"}
            </span>
          </motion.div>
        </div>

        {/* Dados */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {INFO.map(({ icon, label, value }, i) => (
            <motion.div key={label}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <div className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }}>{icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-sm font-medium uppercase leading-snug" style={{ color: "var(--text-primary)" }}>{value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Ações */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="px-6 py-5 shrink-0 space-y-2.5"
          style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onEditar}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-opacity"
            style={{ background: "var(--accent)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
            <Pencil size={14} /> Editar dados
          </button>
          <button onClick={onToggleStatus}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold transition-colors"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: cliente.ativo ? "#f87171" : "#4ade80" }}>
            <Power size={13} />
            {cliente.ativo ? "Desativar cliente" : "Ativar cliente"}
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}

// ─── Wizard ───────────────────────────────────────────────
function WizardCliente({
  inicial, editandoId, onClose, onSalvo,
}: {
  inicial: ClienteForm | null
  editandoId: number | null
  onClose: () => void
  onSalvo: () => void
}) {
  const qc = useQueryClient()
  const [step, setStep]         = useState(1)
  const [dir, setDir]           = useState(1)
  const [form, setForm]         = useState<ClienteForm>(inicial ?? EMPTY)
  const [erro, setErro]         = useState("")
  const [saving, setSaving]     = useState(false)
  const [salvoOk, setSalvoOk]   = useState(false)
  const [confete, setConfete]   = useState(false)
  const [cepStatus, setCepStatus] = useState<CepStatus>(
    inicial?.logradouro ? "encontrado" : "idle"
  )
  const [returnToRevisao, setReturnToRevisao] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 9 steps: 1-Nome 2-Apelido 3-CPF 4-Nasc 5-Celular 6-Instagram 7-CEP 8-Número/Compl 9-Revisão
  const TOTAL = 9

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

  async function advanceCep() {
    const limpo = form.cep.replace(/\D/g, "")
    // CEP vazio → pula endereço
    if (!limpo) { go(step + 1); return }
    // já validado → avança
    if (cepStatus === "encontrado" || cepStatus === "manual") { go(step + 1); return }
    // CEP inválido já detectado → não avança
    if (cepStatus === "invalido") {
      setErro("Corrija o CEP ou preencha o endereço manualmente.")
      return
    }
    // ainda idle → buscar agora
    const ok = await buscarCep(form.cep)
    if (ok) go(step + 1)
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
    if (returnToRevisao) { setReturnToRevisao(false); go(TOTAL); return }
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
      }
      if (editandoId) await apiPut(`/clientes/${editandoId}`, payload)
      else            await apiPost("/clientes", payload)
      qc.invalidateQueries({ queryKey: ["clientes"] })
      // Celebração ✨
      setSalvoOk(true)
      setConfete(true)
      setTimeout(() => setConfete(false), 1200)
      setTimeout(() => { setSalvoOk(false); onSalvo() }, 2200)
    } catch (err) {
      const msg = (err as { response?: { data?: { erro?: string } } })?.response?.data?.erro
      setErro(msg ?? "Erro ao salvar. Tente novamente.")
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
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--bg-base)" }}
    >
      {/* ── Tela de Sucesso ── */}
      <AnimatePresence>
        {salvoOk && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6"
            style={{ background: "var(--bg-base)" }}>
            {/* Círculo pulsante */}
            <div className="relative">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5, times: [0, 0.6, 1] }}
                className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--accent), #34d399)" }}>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.25, type: "spring", stiffness: 400 }}>
                  <Check size={42} color="#fff" strokeWidth={3} />
                </motion.div>
              </motion.div>
              {/* Ondas */}
              {[0, 1, 2].map(i => (
                <motion.div key={i}
                  className="absolute inset-0 rounded-full"
                  style={{ border: "2px solid var(--accent)", opacity: 0 }}
                  animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
                  transition={{ delay: 0.3 + i * 0.2, duration: 0.8, repeat: 1, ease: "easeOut" }}
                />
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-center">
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {editandoId ? "Cliente atualizado!" : "Cliente cadastrado!"}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {form.nome || ""}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
                    <input ref={inputRef} type="tel" value={form.celular} onChange={e => set("celular", e.target.value)}
                      placeholder="(16) 9 9999-9999"
                      className={inputBase} style={inputStyle} />
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
                      Qual o CEP?
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                      O endereço é preenchido automaticamente após o CEP.
                    </p>

                    {/* Input CEP */}
                    <div className="relative">
                      <input
                        ref={inputRef}
                        value={form.cep}
                        onChange={e => {
                          set("cep", e.target.value)
                          setCepStatus("idle")
                        }}
                        onBlur={e => {
                          const limpo = e.target.value.replace(/\D/g, "")
                          if (limpo.length === 8 && cepStatus === "idle") buscarCep(e.target.value)
                        }}
                        placeholder="00000-000"
                        className={inputBase}
                        style={{
                          ...inputStyle,
                          borderColor: cepStatus === "encontrado" ? "#10b981"
                            : cepStatus === "invalido" ? "#f87171"
                            : "var(--border)",
                        }}
                        maxLength={9}
                      />
                      {cepStatus === "buscando" && (
                        <Loader2 size={18} className="animate-spin absolute right-4 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--accent)" }} />
                      )}
                      {cepStatus === "encontrado" && (
                        <Check size={18} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "#10b981" }} />
                      )}
                    </div>

                    {/* Card endereço encontrado */}
                    <AnimatePresence>
                      {cepStatus === "encontrado" && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="mt-4 flex items-start gap-3 px-4 py-3 rounded-2xl"
                          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}
                        >
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

                      {/* CEP inválido */}
                      {cepStatus === "invalido" && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="mt-4"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle size={15} style={{ color: "#f87171" }} />
                            <p className="text-sm font-medium" style={{ color: "#f87171" }}>
                              CEP não encontrado.
                            </p>
                          </div>
                          <button
                            onClick={ativarManual}
                            className="text-xs font-medium underline underline-offset-2 transition-opacity"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.65" }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                            Preencher endereço manualmente →
                          </button>
                        </motion.div>
                      )}

                      {/* Campos manuais */}
                      {cepStatus === "manual" && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          className="mt-4 space-y-2"
                        >
                          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                            Preencha o endereço manualmente:
                          </p>
                          <input value={form.logradouro} onChange={e => set("logradouro", e.target.value)}
                            placeholder="Rua / Avenida / Travessa..."
                            className={cn(inputBase, "!text-base !py-3")} style={inputStyle} />
                          <div className="grid grid-cols-2 gap-2">
                            <input value={form.bairro} onChange={e => set("bairro", e.target.value)}
                              placeholder="Bairro" className={cn(inputBase, "!text-base !py-3")} style={inputStyle} />
                            <input value={form.cidade} onChange={e => set("cidade", e.target.value)}
                              placeholder="Cidade" className={cn(inputBase, "!text-base !py-3")} style={inputStyle} />
                          </div>
                          <input value={form.estado} onChange={e => set("estado", e.target.value)}
                            placeholder="UF (ex: SP)" maxLength={2}
                            className={cn(inputBase, "!text-base !py-3")} style={inputStyle} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {/* ── Step 8: Número e Complemento ── */}
                {step === 8 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Número e complemento?
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                      {enderecoFormatado
                        ? <span style={{ color: "var(--text-secondary)" }}>{form.logradouro}{form.bairro ? `, ${form.bairro}` : ""}</span>
                        : "Apto, casa, bloco, etc."}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                          Número
                        </p>
                        <input ref={inputRef} value={form.numero} onChange={e => set("numero", e.target.value)}
                          placeholder="EX: 123"
                          className={inputBase} style={inputStyle} autoComplete="off" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                          Complemento
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
                    {cepStatus === "buscando" ? <><Loader2 size={14} className="animate-spin" /> Buscando...</> : (
                      <>{step === 1 ? "OK, continuar" : "Continuar"} <ArrowRight size={15} /></>
                    )}
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
            /* ── Step 7: Revisão ── */
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
                    { label: "Instagram",  value: form.instagram ? `@${form.instagram}` : "—",      s: 6             },
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

// ─── Página ───────────────────────────────────────────────
export default function ClientesPage() {
  const qc = useQueryClient()
  const [busca, setBusca]         = useState("")
  const [status, setStatus]       = useState("ativos")
  const [wizard, setWizard]       = useState(false)
  const [editForm, setEditForm]   = useState<ClienteForm | null>(null)
  const [editId, setEditId]       = useState<number | null>(null)
  const [drawer, setDrawer]       = useState<Cliente | null>(null)

  const statusParam = status === "inativos" ? "inativo" : status === "todos" ? "todos" : undefined

  const { data, isLoading } = useQuery<{ data: Cliente[]; total: number }>({
    queryKey: ["clientes", busca, statusParam],
    queryFn: () => {
      const qs = new URLSearchParams({
        limit: "100",
        ...(busca && { busca }),
        ...(statusParam && { status: statusParam }),
      }).toString()
      return apiGet(`/clientes?${qs}`)
    },
    staleTime: 30_000,
  })

  const toggleStatus = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      apiPatch(`/clientes/${id}/status`, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
  })

  function abrirDrawer(c: Cliente) {
    setDrawer(c)
  }

  function abrirEdicao(c: Cliente) {
    setDrawer(null)
    setEditId(c.id)
    setEditForm({
      nome: c.nome, apelido: c.apelido ?? "", cpf_cnpj: c.cpf_cnpj ?? "", data_nasc: c.data_nasc ?? "",
      celular: c.celular ?? "", instagram: c.instagram ?? "",
      cep: c.cep ?? "", logradouro: c.logradouro ?? "", numero: c.numero ?? "",
      complemento: c.complemento ?? "", bairro: c.bairro ?? "",
      cidade: c.cidade ?? "", estado: c.estado ?? "",
    })
    setWizard(true)
  }

  const clientes = data?.data ?? []

  const [tableFocused, setTableFocused] = useState(false)
  const { sel, onKeyDown: tableKeyDown, reset: resetSel } = useTableKeyNav(clientes, (c) => abrirDrawer(c))

  return (
    <div className="space-y-5">
      {/* Header */}
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
            placeholder="Buscar por nome, CPF ou WhatsApp"
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
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Nome", "WhatsApp", "Instagram", "Status", "Ações"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "var(--accent)" }} />
                </td></tr>
              ) : clientes.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Nenhum cliente encontrado.
                </td></tr>
              ) : clientes.map((c, idx) => (
                <tr key={c.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border)", background: sel === idx ? "var(--accent-bg)" : "transparent", borderLeft: sel === idx ? "3px solid var(--accent)" : "3px solid transparent", outline: "none" }}
                  onMouseEnter={e => { if (sel !== idx) (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)" }}
                  onMouseLeave={e => { if (sel !== idx) (e.currentTarget as HTMLTableRowElement).style.background = "transparent" }}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>{c.nome}</p>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{c.celular ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium uppercase" style={{ color: "var(--text-secondary)" }}>
                    {c.instagram ? `@${c.instagram}` : "—"}
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
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrirDrawer(c)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => toggleStatus.mutate({ id: c.id, ativo: !c.ativo })}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = c.ativo ? "#f87171" : "#4ade80" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                        {c.ativo ? <UserX size={14} /> : <UserCheck size={14} />}
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
            onClose={() => { setWizard(false); setEditForm(null); setEditId(null) }}
            onSalvo={() => { setWizard(false); setEditForm(null); setEditId(null) }}
          />
        )}
      </AnimatePresence>

      {/* Drawer Resumo */}
      <AnimatePresence>
        {drawer && (
          <DrawerCliente
            cliente={drawer}
            onClose={() => setDrawer(null)}
            onEditar={() => abrirEdicao(drawer)}
            onToggleStatus={() => {
              toggleStatus.mutate({ id: drawer.id, ativo: !drawer.ativo })
              setDrawer(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
