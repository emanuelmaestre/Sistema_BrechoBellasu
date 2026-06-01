"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "motion/react"
import {
  Plus, Search, Pencil, Loader2, Package,
  X, ChevronLeft, ArrowRight, Check, Trash2,
} from "lucide-react"
import { apiGet, apiPost, apiPut, apiDelete } from "@/services/api"
import { SuccessOverlay } from "@/components/SuccessOverlay"
import { fmtBRL, cn } from "@/lib/utils"
import type { Produto, Categoria } from "@/types"
import { useTableKeyNav, useDropdownKeyNav } from "@/hooks/useKeyNav"

// ─── Tipos ────────────────────────────────────────────────
interface ProdutoForm {
  nome: string
  codigo: string
  categoria_id: string
  marca: string
  preco_venda: string
  preco_custo: string
  estoque_atual: string
  unidade_medida: string
  controlar_estoque: boolean
}

const EMPTY: ProdutoForm = {
  nome: "", codigo: "", categoria_id: "", marca: "",
  preco_venda: "", preco_custo: "",
  estoque_atual: "", unidade_medida: "pc",
  controlar_estoque: true,
}

// ─── Sugestão inteligente de categoria ───────────────────
const KEYWORDS: [string[], string[]][] = [
  [["vestido", "dress"],                               ["vestido", "vestidos"]],
  [["calca", "calça", "jeans", "legging", "leggings"], ["calca", "calças", "calca", "jeans", "legging"]],
  [["shorts", "short"],                                ["shorts"]],
  [["blusa", "blusinha"],                              ["blusa", "blusas"]],
  [["camisa", "camisao"],                              ["camisa", "camisas"]],
  [["camiseta", "t-shirt", "tshirt"],                  ["camiseta", "camisetas"]],
  [["saia", "sainha"],                                 ["saia", "saias"]],
  [["jaqueta", "jacket"],                              ["jaqueta", "jaquetas"]],
  [["casaco", "blazer", "sobretudo"],                  ["casaco", "casacos", "blazer"]],
  [["moletom", "moleton", "hoodie", "agasalho"],       ["moletom", "moletons"]],
  [["cropped"],                                        ["cropped"]],
  [["body", "macacão", "macacao"],                     ["body", "bodies", "macacão"]],
  [["bermuda"],                                        ["bermuda", "bermudas"]],
  [["top", "regata"],                                  ["top", "regata", "regatas"]],
  [["trico", "tricô", "sueter", "suéter"],             ["trico", "tricô"]],
  [["tênis", "tenis", "sapato", "sandalia", "sandália", "bota", "chinelo", "rasteira"], ["calcado", "calçado", "sapatos", "tenis", "sapato"]],
  [["bolsa", "carteira", "mochila"],                   ["bolsa", "bolsas", "acessorio"]],
  [["cinto", "colar", "brinco", "anel", "pulseira"],   ["acessorio", "acessórios"]],
  [["pijama", "robe", "camisola"],                     ["pijama", "camisola"]],
  [["maio", "biquini", "biquíni", "sunga"],             ["moda praia", "biquini"]],
]

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
}

function sugerirCategoria(nomeProduto: string, categorias: { id: number; nome: string }[]): string {
  const nome = normalize(nomeProduto)
  for (const [keywords, catTerms] of KEYWORDS) {
    const matchKeyword = keywords.some(k => nome.includes(k))
    if (!matchKeyword) continue
    // tenta achar categoria cujo nome normalize coincide com um dos termos
    const cat = categorias.find(c => catTerms.some(t => normalize(c.nome).includes(t) || t.includes(normalize(c.nome))))
    if (cat) return String(cat.id)
    // fallback: qualquer categoria que contenha uma das keywords no nome
    const fallback = categorias.find(c => keywords.some(k => normalize(c.nome).includes(k)))
    if (fallback) return String(fallback.id)
  }
  // último recurso: categoria que tenha qualquer palavra do nome do produto
  const words = nome.split(/\s+/).filter(w => w.length > 3)
  for (const word of words) {
    const cat = categorias.find(c => normalize(c.nome).includes(word))
    if (cat) return String(cat.id)
  }
  return ""
}

// ─── Animação ─────────────────────────────────────────────
const variants = {
  enter:  (d: number) => ({ x: d > 0 ?  60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: d > 0 ? -60 :  60, opacity: 0 }),
}

// ─── Autocomplete Marca ───────────────────────────────────
function MarcaStep({ inputRef, value, onChange, onAdvance, inputBase, inputSt }: {
  inputRef: React.RefObject<HTMLInputElement | null>
  value: string
  onChange: (v: string) => void
  onAdvance: () => void
  inputBase: string
  inputSt: React.CSSProperties
}) {
  const qc = useQueryClient()
  const [busca, setBusca] = useState(value)
  const [open, setOpen] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)
  const [novaCadastrada, setNovaCadastrada] = useState(false)

  const { data: sugestoes = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["marcas-busca", busca],
    queryFn: () => apiGet(`/produtos/meta/marcas?busca=${encodeURIComponent(busca)}`),
    enabled: busca.length >= 1,
    staleTime: 60_000,
  })

  function selecionar(item: { id: number; nome: string }) {
    setBusca(item.nome)
    onChange(item.nome)
    setOpen(false)
    setNovaCadastrada(false)
  }

  const { hi, onKeyDown: dropKeyDown, reset: resetHi } = useDropdownKeyNav(sugestoes, selecionar, () => setOpen(false))

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      const texto = busca.trim()
      if (!texto) { onAdvance(); return }

      // Se há sugestão selecionada pelo teclado, usa ela
      if (hi >= 0 && sugestoes[hi]) {
        selecionar(sugestoes[hi])
        onAdvance()
        return
      }

      // Verifica se já existe nos resultados (match exato)
      const match = sugestoes.find(m => m.nome.toLowerCase() === texto.toLowerCase())
      if (match) {
        selecionar(match)
        onAdvance()
        return
      }

      // Não encontrou — cadastra automaticamente
      setCadastrando(true)
      try {
        const nova = await apiPost<{ id: number; nome: string }>("/produtos/meta/marcas", { nome: texto })
        qc.invalidateQueries({ queryKey: ["marcas-busca"] })
        setBusca(nova.nome)
        onChange(nova.nome)
        setNovaCadastrada(true)
        setTimeout(() => { setNovaCadastrada(false); onAdvance() }, 900)
      } catch {
        onChange(texto)
        onAdvance()
      } finally {
        setCadastrando(false)
        setOpen(false)
      }
      return
    }
    dropKeyDown(e)
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Marca?</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Digite para buscar. Se não existir, será cadastrada automaticamente ao pressionar Enter.
      </p>
      <div className="relative">
        <input ref={inputRef} value={busca}
          onChange={e => { setBusca(e.target.value); onChange(e.target.value); setOpen(true); resetHi(); setNovaCadastrada(false) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Digite para buscar a marca..."
          className={inputBase} style={inputSt} autoComplete="off"
          disabled={cadastrando} />
        {/* Feedback de cadastro */}
        {novaCadastrada && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-1 rounded-full"
            style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
            ✓ Cadastrada!
          </span>
        )}
        {cadastrando && (
          <Loader2 size={16} className="animate-spin absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "var(--accent)" }} />
        )}
        {open && sugestoes.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl overflow-hidden shadow-lg z-50"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            {sugestoes.map((m, idx) => (
              <button key={m.id} onMouseDown={() => { selecionar(m); onAdvance() }}
                className="w-full px-5 py-3 text-left text-sm font-medium uppercase tracking-wide transition-colors"
                style={{
                  color: hi === idx ? "var(--accent)" : "var(--text-primary)",
                  background: hi === idx ? "var(--accent-bg)" : "transparent",
                  borderBottom: "1px solid var(--border)",
                }}>
                {m.nome}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Wizard ───────────────────────────────────────────────
function WizardProduto({
  inicial, editandoId, initialStep, categorias, onClose, onSalvo,
}: {
  inicial: ProdutoForm | null
  editandoId: number | null
  initialStep?: number
  categorias: Categoria[]
  onClose: () => void
  onSalvo: () => void
}) {
  const qc = useQueryClient()
  const [step, setStep]   = useState(initialStep ?? 1)
  const [dir, setDir]     = useState(1)
  const [form, setForm]   = useState<ProdutoForm>(inicial ?? EMPTY)
  const [erro, setErro]   = useState("")
  const [saving, setSaving] = useState(false)
  const [salvoOk, setSalvoOk] = useState(false)
  const [catSugerida, setCatSugerida] = useState(false)  // indica se categoria foi auto-sugerida
  const [returnToRevisao, setReturnToRevisao] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const TOTAL = 6

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 280)
    return () => clearTimeout(t)
  }, [step])

  // ── Auto-sugestão de categoria ao entrar no step 3 ──
  useEffect(() => {
    if (step !== 3) return
    if (form.categoria_id) { setCatSugerida(false); return }  // já tem categoria, não sobrescreve
    const sugestao = sugerirCategoria(form.nome, categorias)
    if (sugestao) {
      setForm(f => ({ ...f, categoria_id: sugestao }))
      setCatSugerida(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  function set<K extends keyof ProdutoForm>(k: K, v: ProdutoForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
    setErro("")
  }

  function go(next: number) {
    setDir(next > step ? 1 : -1)
    setStep(next)
    setErro("")
  }

  function advance() {
    if (step === 1 && form.nome.trim().length < 1) {
      setErro("Nome do produto é obrigatório")
      return
    }
    if (step === 4 && Number(form.preco_venda) < 0) {
      setErro("Preço inválido")
      return
    }
    if (returnToRevisao) { setReturnToRevisao(false); go(TOTAL); return }
    if (step < TOTAL) go(step + 1)
  }

  async function handleSalvar() {
    setSaving(true)
    setErro("")
    try {
      const payload = {
        nome:              form.nome.trim(),
        codigo:            form.codigo    || null,
        categoria_id:      form.categoria_id ? Number(form.categoria_id) : null,
        marca:             form.marca     || null,
        preco_venda:       parseFloat(form.preco_venda.replace(",","."))  || 0,
        preco_custo:       parseFloat(form.preco_custo.replace(",","."))  || 0,
        estoque_atual:     Number(form.estoque_atual) || 0,
        unidade_medida:    form.unidade_medida,
        controlar_estoque: form.controlar_estoque,
      }
      if (editandoId) await apiPut(`/produtos/${editandoId}`, payload)
      else            await apiPost("/produtos", payload)
      qc.invalidateQueries({ queryKey: ["produtos"] })
      setSalvoOk(true)
      setTimeout(() => { setSalvoOk(false); onSalvo() }, 2200)
    } catch (e) {
      setErro((e as Error).message || "Erro ao salvar. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (step === 2) return // MarcaStep gerencia seu próprio Enter
    if (e.key === "Enter" && step === TOTAL) { e.preventDefault(); handleSalvar(); return }
    if (e.key === "Enter" && step < TOTAL) { e.preventDefault(); advance() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form])

  const inputBase = "w-full px-5 py-4 text-lg rounded-2xl outline-none transition-all border-2 focus:border-[color:var(--accent)]"
  const inputSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }

  const catNome = categorias.find(c => String(c.id) === form.categoria_id)?.nome ?? "—"

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>

      <SuccessOverlay show={salvoOk} titulo={editandoId ? "Produto atualizado!" : "Produto cadastrado!"} subtitulo={form.nome || ""} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>Brechó Bellasu</span>
          <span style={{ color: "var(--border-hover)" }}>|</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {editandoId ? "Editar Produto" : "Novo Produto"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium tabular-nums" style={{ color: "var(--text-muted)" }}>{step} / {TOTAL}</span>
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
            <motion.div key={step} custom={dir}
              variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="absolute inset-0 flex flex-col items-center justify-center px-6">
              <div className="w-full max-w-xl">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base font-bold" style={{ color: "var(--accent)" }}>{step}</span>
                  <ArrowRight size={14} style={{ color: "var(--accent)" }} />
                </div>

                {step === 1 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Qual é o nome do produto?
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Campo obrigatório.</p>
                    <input ref={inputRef} value={form.nome} onChange={e => set("nome", e.target.value)}
                      placeholder="Ex: Vestido Floral Verão"
                      className={inputBase} style={inputSt} autoComplete="off" />
                  </>
                )}

                {step === 2 && (
                  <MarcaStep inputRef={inputRef} value={form.marca} onChange={v => set("marca", v)} onAdvance={advance} inputBase={inputBase} inputSt={inputSt} />
                )}

                {step === 3 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Categoria?
                    </h1>
                    <div className="flex items-center gap-3 mb-6">
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Organiza o produto no estoque e relatórios.</p>
                      {catSugerida && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.85, x: 6 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
                          style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.3)" }}>
                          ✦ Sugestão automática
                        </motion.span>
                      )}
                    </div>
                    <select value={form.categoria_id}
                      onChange={e => { set("categoria_id", e.target.value); setCatSugerida(false) }}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); advance() } }}
                      className={inputBase} style={inputSt}>
                      <option value="">Sem categoria</option>
                      {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    {catSugerida && (
                      <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                        💡 Detectei <strong style={{ color: "var(--text-secondary)" }}>"{categorias.find(c => String(c.id) === form.categoria_id)?.nome}"</strong> com base no nome do produto. Altere se necessário.
                      </p>
                    )}
                  </>
                )}

                {step === 4 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Preço de venda?
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Valor que será cobrado do cliente.</p>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-semibold"
                        style={{ color: "var(--text-muted)" }}>R$</span>
                      <input ref={inputRef} type="text" inputMode="decimal"
                        value={form.preco_venda}
                        onChange={e => set("preco_venda", e.target.value.replace(",", "."))}
                        onBlur={e => { const v = parseFloat(e.target.value.replace(",",".")); set("preco_venda", isNaN(v) ? "0,00" : v.toFixed(2).replace(".",",")) }}
                        className={cn(inputBase, "pl-14")} style={inputSt} />
                    </div>
                    <div className="mt-4">
                      <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>Preço de custo:</p>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base"
                          style={{ color: "var(--text-muted)" }}>R$</span>
                        <input type="text" inputMode="decimal"
                          value={form.preco_custo}
                          onChange={e => set("preco_custo", e.target.value.replace(",", "."))}
                          onBlur={e => { const v = parseFloat(e.target.value.replace(",",".")); set("preco_custo", isNaN(v) ? "0,00" : v.toFixed(2).replace(".",",")) }}
                          className={cn(inputBase, "pl-12 !text-base !py-3")} style={inputSt} />
                      </div>
                    </div>
                  </>
                )}

                {step === 5 && (
                  <>
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                      Estoque inicial?
                    </h1>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Quantas unidades estão disponíveis agora.</p>
                    <div className="flex gap-3">
                      <input ref={inputRef} type="number" min="0"
                        value={form.estoque_atual} onChange={e => set("estoque_atual", e.target.value)}
                        className={cn(inputBase, "flex-1")} style={inputSt} />
                      <select value={form.unidade_medida} onChange={e => set("unidade_medida", e.target.value)}
                        className={cn(inputBase, "w-36")} style={inputSt}>
                        <option value="pc">PEÇA (PC)</option>
                        <option value="par">PAR (PAR)</option>
                        <option value="cj">CONJUNTO (CJ)</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-3 mt-5 cursor-pointer">
                      <div onClick={() => set("controlar_estoque", !form.controlar_estoque)}
                        className={cn("w-11 h-6 rounded-full transition-all relative",
                          form.controlar_estoque ? "bg-[color:var(--accent)]" : "bg-[color:var(--border-hover)]")}>
                        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all",
                          form.controlar_estoque ? "left-6" : "left-1")} />
                      </div>
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Controlar estoque</span>
                    </label>
                  </>
                )}

                <AnimatePresence>
                  {erro && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-2 text-sm" style={{ color: "#f87171" }}>{erro}</motion.p>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-4 mt-8">
                  <button onClick={advance}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg transition-opacity"
                    style={{ background: "var(--accent)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
                    {step === 1 ? "OK, continuar" : "Continuar"} <ArrowRight size={15} />
                  </button>
                  {step > 1 && (
                    <button onClick={() => { if (returnToRevisao) { setReturnToRevisao(false); go(TOTAL) } else go(step + 1) }}
                      className="text-sm font-medium transition-colors" style={{ color: "var(--text-muted)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                      {returnToRevisao ? "← Voltar ao resumo" : "Pular →"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

          ) : (
            /* Revisão */
            <motion.div key="revisao" custom={dir}
              variants={variants} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="absolute inset-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

              {/* Sidebar */}
              <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col items-center justify-between py-4 md:py-10 px-5 md:px-6 gap-4 md:gap-0"
                style={{ background: "var(--accent)" }}>
                <div className="flex flex-row md:flex-col items-center gap-4 md:text-center">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-2xl flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.2)" }}>
                      <Package size={22} color="#fff" className="md:hidden" />
                      <Package size={32} color="#fff" className="hidden md:block" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center bg-emerald-500">
                      <Check size={10} color="#fff" className="md:hidden" />
                      <Check size={14} color="#fff" className="hidden md:block" />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-sm md:text-lg leading-tight text-white uppercase">{form.nome || "—"}</p>
                    <p className="text-xs mt-1 hidden md:block" style={{ color: "rgba(255,255,255,0.6)" }}>Revise antes de salvar</p>
                  </div>
                </div>
                <div className="flex flex-row md:flex-col gap-2 md:w-full shrink-0">
                  <button onClick={handleSalvar} disabled={saving}
                    className="py-2.5 md:py-3 px-4 md:px-0 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 md:w-full"
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

              {/* Painel */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-10" style={{ background: "var(--bg-base)" }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-6"
                  style={{ color: "var(--text-muted)" }}>◎ Dados do Produto</h2>
                {erro && <p className="mb-4 text-sm px-4 py-2 rounded-xl" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>{erro}</p>}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Nome",           value: form.nome || "—",                                    s: 1, full: true },
                    { label: "Marca",          value: form.marca || "—",                                   s: 2 },
                    { label: "Categoria",      value: catNome,                                             s: 3 },
                    { label: "Preço de venda", value: fmtBRL(Number(form.preco_venda)),                    s: 4 },
                    { label: "Preço de custo", value: fmtBRL(Number(form.preco_custo)),                    s: 4 },
                    { label: "Estoque",        value: `${form.estoque_atual} ${form.unidade_medida}`,      s: 5 },
                  ].map(({ label, value, s, full }) => (
                    <div key={label} className={cn("rounded-2xl p-4", full ? "col-span-2" : "")}
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
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

      {/* Footer */}
      {step < TOTAL && (
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
            Pressione <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Enter</kbd> para avançar
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Página ───────────────────────────────────────────────
export default function ProdutosPage() {
  const qc = useQueryClient()
  const [busca, setBusca]       = useState("")
  const [catFiltro, setCat]     = useState("")
  const [wizard, setWizard]       = useState(false)
  const [editForm, setEditForm]   = useState<ProdutoForm | null>(null)
  const [editId, setEditId]       = useState<number | null>(null)
  const [editInitStep, setEditInitStep] = useState<number>(1)
  const [excluindoId, setExcluindoId] = useState<number | null>(null)

  async function excluirProduto(id: number) {
    if (!confirm("Confirma exclusão deste produto? Esta ação não pode ser desfeita.")) return
    setExcluindoId(id)
    try {
      await apiDelete(`/produtos/${id}`)
      qc.invalidateQueries({ queryKey: ["produtos"] })
    } catch { alert("Erro ao excluir produto.") } finally { setExcluindoId(null) }
  }

  const { data, isLoading } = useQuery<{ data: Produto[]; total: number }>({
    queryKey: ["produtos", busca, catFiltro],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: "100", ...(busca && { busca }), ...(catFiltro && { categoria_id: catFiltro }) }).toString()
      return apiGet(`/produtos?${qs}`)
    },
    staleTime: 30_000,
  })

  const { data: cats } = useQuery<Categoria[]>({
    queryKey: ["categorias"],
    queryFn: () => apiGet("/produtos/meta/categorias"),
    staleTime: 300_000,
  })

  const produtos   = data?.data ?? []
  const categorias = cats ?? []

  const [tableFocused, setTableFocused] = useState(false)
  const { sel, onKeyDown: tableKeyDown, reset: resetSel } = useTableKeyNav(produtos, (p) => abrirEdicao(p))

  function abrirEdicao(p: Produto) {
    setEditId(p.id)
    setEditForm({
      nome: p.nome, codigo: p.codigo ?? "",
      categoria_id: p.categoria_id != null ? String(p.categoria_id) : "",
      marca: p.marca ?? "",
      preco_venda: String(p.preco_venda ?? 0),
      preco_custo: String(p.preco_custo ?? 0),
      estoque_atual: String(p.estoque_atual ?? 0),
      unidade_medida: p.unidade_medida ?? "un",
      controlar_estoque: p.controlar_estoque ?? true,
    })
    setEditInitStep(6)   // abre direto no resumo
    setWizard(true)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>Produtos</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{data?.total ?? 0} produtos</p>
        </div>
        <button onClick={() => { setEditForm(null); setEditId(null); setEditInitStep(1); setWizard(true) }}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white shadow-lg transition-opacity"
          style={{ background: "var(--accent)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}>
          <Plus size={16} /> Novo Produto
        </button>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou código"
            className="w-full pl-10 pr-4 py-2 rounded-xl text-sm outline-none transition-all"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)" }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)" }} />
        </div>
        <select value={catFiltro} onChange={e => setCat(e.target.value)}
          className="py-2 px-3 rounded-xl text-sm outline-none transition-all min-w-[140px]"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <option value="">Todas categorias</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
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
                {["Código", "Produto", "Marca", "Categoria", "Preço Venda", "Preço Custo", "Estoque", "Ações"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center">
                  <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "var(--accent)" }} />
                </td></tr>
              ) : produtos.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center">
                  <Package size={32} className="mx-auto mb-2" style={{ color: "var(--border-hover)" }} />
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhum produto encontrado.</p>
                </td></tr>
              ) : produtos.map((p, idx) => (
                <tr key={p.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border)", background: sel === idx ? "var(--accent-bg)" : "transparent", borderLeft: sel === idx ? "3px solid var(--accent)" : "3px solid transparent", outline: "none" }}
                  onMouseEnter={e => { if (sel !== idx) (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)" }}
                  onMouseLeave={e => { if (sel !== idx) (e.currentTarget as HTMLTableRowElement).style.background = "transparent" }}>
                  <td className="px-4 py-3 font-mono text-xs uppercase" style={{ color: "var(--text-muted)" }}>{p.codigo ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>{p.nome}</p>
                  </td>
                  <td className="px-4 py-3 text-sm uppercase" style={{ color: "var(--text-muted)" }}>{p.marca ?? "—"}</td>
                  <td className="px-4 py-3 text-sm uppercase" style={{ color: "var(--text-secondary)" }}>
                    {(p as Produto & { categoria_nome?: string }).categoria_nome ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmtBRL(p.preco_venda)}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>{fmtBRL(p.preco_custo)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full uppercase",
                      (p.estoque_atual ?? 0) > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
                      {p.estoque_atual ?? 0} {p.unidade_medida ?? "un"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => abrirEdicao(p)}
                        className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => excluirProduto(p.id)} disabled={excluindoId === p.id}
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-40" style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)" }}>
                        {excluindoId === p.id ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14} />}
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

      <AnimatePresence>
        {wizard && (
          <WizardProduto
            inicial={editForm} editandoId={editId} initialStep={editInitStep} categorias={categorias}
            onClose={() => { setWizard(false); setEditForm(null); setEditId(null); setEditInitStep(1) }}
            onSalvo={() => { setWizard(false); setEditForm(null); setEditId(null); setEditInitStep(1) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
