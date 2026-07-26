"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "motion/react"
import {
  Plus, Search, Pencil, Loader2, Package,
  X, ChevronLeft, ArrowRight, Check, Trash2,
} from "lucide-react"
import { apiGet, apiPost, apiPut, apiDelete } from "@/services/api"
import { useDebounce } from "@/hooks/useDebounce"
import { SuccessOverlay } from "@/components/SuccessOverlay"
import { fmtBRL, cn } from "@/lib/utils"
import type { Produto, Categoria } from "@/types"
import { useTableKeyNav, useDropdownKeyNav } from "@/hooks/useKeyNav"
import productData from "@/data/catalog/products.json"

const TAMANHOS = productData.sizes
const CORES_PRODUTO: { nome: string; hex: string }[] = productData.colors
const KEYWORDS: [string[], string[]][] = productData.categoryKeywords.map(
  ({ keywords, categories }) => [keywords, categories],
)


// ─── Tipos ────────────────────────────────────────────────
interface ProdutoForm {
  nome: string
  codigo: string
  categoria_id: string
  marca: string
  preco_venda: string
  preco_custo: string
  cor: string
  tamanho: string
}

const EMPTY: ProdutoForm = {
  nome: "", codigo: "", categoria_id: "", marca: "",
  preco_venda: "", preco_custo: "",
  cor: "", tamanho: "",
}

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
  const buscaDebounced = useDebounce(busca, 350)
  const [open, setOpen] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)
  const [novaCadastrada, setNovaCadastrada] = useState(false)

  const { data: sugestoes = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["marcas-busca", buscaDebounced],
    queryFn: () => apiGet(`/produtos/meta/marcas?busca=${encodeURIComponent(buscaDebounced)}`),
    enabled: buscaDebounced.length >= 1,
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
            <div className="overflow-y-auto" style={{
              maxHeight: "calc(4 * 49px)",
              scrollbarWidth: "thin",
              scrollbarColor: "var(--accent) var(--bg-surface)",
            }}>
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
          </div>
        )}
      </div>
    </>
  )
}

// ─── Seletor de Cor com chips visuais ────────────────────
function CorStep({ inputRef, value, onChange, onAdvance, inputBase, inputSt }: {
  inputRef: React.RefObject<HTMLInputElement | null>
  value: string
  onChange: (v: string) => void
  onAdvance: () => void
  inputBase: string
  inputSt: React.CSSProperties
}) {
  const [busca, setBusca] = useState("")

  const filtradas = busca.trim().length === 0
    ? CORES_PRODUTO
    : CORES_PRODUTO.filter(c => c.nome.includes(busca.toUpperCase()))

  function selecionar(cor: string) {
    onChange(cor)
    setTimeout(() => onAdvance(), 150)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      const texto = busca.trim().toUpperCase()
      if (!texto && value) { onAdvance(); return }
      const exata = CORES_PRODUTO.find(c => c.nome === texto)
      if (exata) selecionar(exata.nome)
      else if (filtradas.length === 1) selecionar(filtradas[0].nome)
      else if (texto) selecionar(texto)
    }
  }

  const isGradient = (hex: string) => hex.startsWith("linear-gradient") || hex.startsWith("repeating")

  return (
    <>
      <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Cor?</h1>
      <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
        Selecione ou digite para filtrar.
      </p>

      {/* Campo de busca */}
      <input
        ref={inputRef}
        value={busca}
        onChange={e => setBusca(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="BUSCAR COR..."
        className={inputBase}
        style={{ ...inputSt, marginBottom: "1.25rem" }}
        autoComplete="off"
      />

      {/* Grade de chips */}
      <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
        {filtradas.map(c => {
          const selecionado = value === c.nome
          const claro = ["BRANCO","OFF WHITE","NUDE","BEGE","PRATA","PÊSSEGO","FLORAL","AMARELO","LAVANDA"].includes(c.nome)
          return (
            <motion.button
              key={c.nome}
              onClick={() => selecionar(c.nome)}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all"
              style={{
                background: selecionado ? "var(--accent)" : "var(--bg-surface)",
                color: selecionado ? "#fff" : "var(--text-primary)",
                border: selecionado ? "2px solid var(--accent)" : "1px solid var(--border)",
                boxShadow: selecionado ? "0 0 12px var(--accent)" : "none",
              }}
            >
              {/* Bolinha da cor */}
              <span
                className="w-4 h-4 rounded-full shrink-0 border"
                style={{
                  background: isGradient(c.hex) ? c.hex : c.hex,
                  borderColor: claro ? "#94a3b8" : "transparent",
                  boxShadow: selecionado ? "none" : "inset 0 1px 2px rgba(0,0,0,0.3)",
                }}
              />
              {c.nome}
              {selecionado && <Check size={11} strokeWidth={3} />}
            </motion.button>
          )
        })}

        {/* Cor personalizada se busca não bate em nada */}
        {busca.trim().length > 0 && filtradas.length === 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            onClick={() => selecionar(busca.trim().toUpperCase())}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wide"
            style={{ background: "var(--accent)", color: "#fff", border: "none" }}
          >
            <Check size={11} strokeWidth={3} />
            Usar &quot;{busca.toUpperCase()}&quot;
          </motion.button>
        )}
      </div>
    </>
  )
}

// ─── Wizard Produto (tela única) ──────────────────────────
function WizardProduto({
  inicial, editandoId, categorias, onClose, onSalvo,
}: {
  inicial: ProdutoForm | null
  editandoId: number | null
  initialStep?: number
  categorias: Categoria[]
  onClose: () => void
  onSalvo: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm]           = useState<ProdutoForm>(inicial ?? EMPTY)
  const [erro, setErro]           = useState("")
  const [saving, setSaving]       = useState(false)
  const [salvoOk, setSalvoOk]     = useState(false)
  const [corBusca, setCorBusca]   = useState("")
  const [marcaBusca, setMarcaBusca] = useState(inicial?.marca ?? "")
  const [marcaOpen, setMarcaOpen]   = useState(false)
  const nomeRef = useRef<HTMLInputElement>(null)
  const marcaBuscaDebounced = useDebounce(marcaBusca, 350)

  const { data: marcaSugestoes = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["marcas-busca", marcaBuscaDebounced],
    queryFn: () => apiGet(`/produtos/meta/marcas?busca=${encodeURIComponent(marcaBuscaDebounced)}`),
    enabled: marcaBuscaDebounced.length >= 1,
    staleTime: 60_000,
  })

  // Auto-sugestão de categoria ao digitar nome
  useEffect(() => {
    if (form.categoria_id || !form.nome.trim()) return
    const sugestao = sugerirCategoria(form.nome, categorias)
    if (sugestao) setForm(f => ({ ...f, categoria_id: sugestao }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nome])

  useEffect(() => { nomeRef.current?.focus() }, [])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  function set<K extends keyof ProdutoForm>(k: K, v: ProdutoForm[K]) {
    setForm(f => ({ ...f, [k]: v })); setErro("")
  }

  function selecionarMarca(nome: string) {
    setMarcaBusca(nome)
    set("marca", nome)
    setMarcaOpen(false)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) { setErro("Nome do produto é obrigatório"); return }
    setSaving(true); setErro("")
    try {
      // Garante que a marca digitada fique cadastrada
      let nomeMarca = form.marca
      if (marcaBusca.trim()) {
        try {
          const nova = await apiPost<{ id: number; nome: string }>("/produtos/meta/marcas", { nome: marcaBusca.trim() })
          qc.invalidateQueries({ queryKey: ["marcas-busca"] })
          nomeMarca = nova.nome
        } catch { nomeMarca = marcaBusca.trim() }
      }
      const payload = {
        nome:              form.nome.trim(),
        codigo:            form.codigo    || null,
        categoria_id:      form.categoria_id ? Number(form.categoria_id) : null,
        marca:             nomeMarca     || null,
        preco_venda:       parseFloat(form.preco_venda.replace(",", ".")) || 0,
        preco_custo:       parseFloat(form.preco_custo.replace(",", ".")) || 0,
        estoque_atual:     1,
        unidade_medida:    "pc",
        controlar_estoque: true,
        cor:               form.cor       || null,
        tamanho:           form.tamanho   || null,
      }
      if (editandoId) await apiPut(`/produtos/${editandoId}`, payload)
      else            await apiPost("/produtos", payload)
      qc.invalidateQueries({ queryKey: ["produtos"] })
      setSalvoOk(true)
      setTimeout(() => { setSalvoOk(false); onSalvo() }, 2200)
    } catch (e) {
      setErro((e as Error).message || "Erro ao salvar. Tente novamente.")
    } finally { setSaving(false) }
  }

  const iBase = "w-full px-3 py-2 text-sm rounded-xl outline-none transition-all border focus:border-[color:var(--accent)]"
  const iSt: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }
  const lSt  = "block text-[10px] font-bold uppercase tracking-wider mb-1"
  const lCol: React.CSSProperties = { color: "var(--text-muted)" }

  const coresFiltradas = corBusca.trim()
    ? CORES_PRODUTO.filter(c => c.nome.includes(corBusca.toUpperCase()))
    : CORES_PRODUTO

  const isGradient = (hex: string) => hex.startsWith("linear-gradient") || hex.startsWith("repeating")

  const precoVendaNum = parseFloat(form.preco_venda.replace(",", ".")) || 0
  const precoCustoNum = parseFloat(form.preco_custo.replace(",", ".")) || 0
  const lucro         = precoVendaNum - precoCustoNum
  const margem        = precoVendaNum > 0 ? (lucro / precoVendaNum) * 100 : 0
  const margemCor     = margem >= 50 ? "#10b981" : margem >= 30 ? "#f59e0b" : "#f87171"

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>
      <SuccessOverlay show={salvoOk} titulo={editandoId ? "Produto atualizado!" : "Produto cadastrado!"} subtitulo="" />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>Brechó Bellasu</span>
          <span style={{ color: "var(--border-hover)" }}>|</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {editandoId ? "Editar Produto" : "Novo Produto"}
          </span>
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
          <X size={15} /> Cancelar
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-hidden flex items-center justify-center px-6 py-4">
        <div className="w-full max-w-2xl space-y-3">

          {/* Nome */}
          <div>
            <label className={lSt} style={lCol}>Nome do produto *</label>
            <input ref={nomeRef} value={form.nome}
              onChange={e => set("nome", e.target.value)}
              placeholder="EX: VESTIDO FLORAL VERÃO"
              className={iBase} style={iSt} autoComplete="off" />
          </div>

          {/* Marca | Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lSt} style={lCol}>Marca</label>
              <div className="relative">
                <input value={marcaBusca}
                  onChange={e => { setMarcaBusca(e.target.value); set("marca", e.target.value); setMarcaOpen(true) }}
                  onFocus={() => setMarcaOpen(true)}
                  onBlur={() => setTimeout(() => setMarcaOpen(false), 150)}
                  placeholder="Buscar marca..."
                  className={iBase} style={iSt} autoComplete="off" />
                {marcaOpen && marcaSugestoes.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-lg z-50"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    {marcaSugestoes.slice(0, 5).map(m => (
                      <button key={m.id} onMouseDown={() => selecionarMarca(m.nome)}
                        className="w-full px-3 py-2 text-left text-sm font-medium uppercase transition-colors"
                        style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-bg)" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
                        {m.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className={lSt} style={lCol}>Categoria</label>
              <select value={form.categoria_id} onChange={e => set("categoria_id", e.target.value)}
                className={iBase} style={iSt}>
                <option value="">Sem categoria</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Tamanho chips */}
          <div>
            <label className={lSt} style={lCol}>Tamanho</label>
            <div className="flex flex-wrap gap-2">
              {TAMANHOS.map(t => {
                const sel = form.tamanho === t
                return (
                  <button key={t}
                    onClick={() => set("tamanho", sel ? "" : t)}
                    className="px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                    style={{
                      background: sel ? "var(--accent)" : "var(--bg-surface)",
                      color: sel ? "#fff" : "var(--text-primary)",
                      border: sel ? "2px solid var(--accent)" : "2px solid var(--border)",
                    }}>
                    {t}{sel && " ✓"}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cor */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className={lSt} style={{ ...lCol, marginBottom: 0 }}>Cor</label>
              {form.cor && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--accent)", color: "#fff" }}>{form.cor}</span>
              )}
            </div>
            <input value={corBusca} onChange={e => setCorBusca(e.target.value)}
              placeholder="Filtrar cor..." className={iBase} style={iSt} autoComplete="off" />
            <div className="flex flex-wrap gap-1.5 mt-2 max-h-16 overflow-y-auto pr-1">
              {coresFiltradas.map(c => {
                const sel = form.cor === c.nome
                const claro = ["BRANCO","OFF WHITE","NUDE","BEGE","PRATA","PÊSSEGO","AMARELO","LAVANDA"].includes(c.nome)
                return (
                  <button key={c.nome} onClick={() => set("cor", sel ? "" : c.nome)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all"
                    style={{
                      background: sel ? "var(--accent)" : "var(--bg-surface)",
                      color: sel ? "#fff" : "var(--text-primary)",
                      border: sel ? "2px solid var(--accent)" : "1px solid var(--border)",
                    }}>
                    <span className="w-3 h-3 rounded-full shrink-0 border"
                      style={{ background: c.hex, borderColor: claro ? "#94a3b8" : "transparent" }} />
                    {c.nome}
                    {sel && <Check size={10} strokeWidth={3} />}
                  </button>
                )
              })}
              {corBusca.trim() && coresFiltradas.length === 0 && (
                <button onClick={() => { set("cor", corBusca.trim().toUpperCase()); setCorBusca("") }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white"
                  style={{ background: "var(--accent)" }}>
                  Usar &quot;{corBusca.toUpperCase()}&quot;
                </button>
              )}
            </div>
          </div>

          {/* Preço venda | Preço custo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lSt} style={lCol}>Preço de venda</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold"
                  style={{ color: "var(--text-muted)" }}>R$</span>
                <input type="text" value={form.preco_venda}
                  onChange={e => set("preco_venda", e.target.value.replace(/[^0-9.,]/g, ""))}
                  onBlur={e => { const v = parseFloat(e.target.value.replace(",", ".")); set("preco_venda", isNaN(v) ? "0,00" : v.toFixed(2).replace(".", ",")) }}
                  placeholder="0,00" className={cn(iBase, "pl-9")} style={iSt} />
              </div>
            </div>
            <div>
              <label className={lSt} style={lCol}>Preço de custo</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold"
                  style={{ color: "var(--text-muted)" }}>R$</span>
                <input type="text" value={form.preco_custo}
                  onChange={e => set("preco_custo", e.target.value.replace(/[^0-9.,]/g, ""))}
                  onBlur={e => { const v = parseFloat(e.target.value.replace(",", ".")); set("preco_custo", isNaN(v) ? "0,00" : v.toFixed(2).replace(".", ",")) }}
                  placeholder="0,00" className={cn(iBase, "pl-9")} style={iSt} />
              </div>
            </div>
          </div>

          {/* Margem */}
          {precoVendaNum > 0 && precoCustoNum > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl"
              style={{ background: "var(--bg-surface)", border: `1px solid ${margemCor}44` }}>
              <span className="text-xs font-black" style={{ color: margemCor }}>
                {margem >= 50 ? "🟢" : margem >= 30 ? "🟡" : "🔴"} Lucro R$ {lucro.toFixed(2).replace(".", ",")} · {margem.toFixed(0)}% margem
              </span>
            </div>
          )}

          {/* Error */}
          {erro && <p className="text-sm" style={{ color: "#f87171" }}>{erro}</p>}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-3 shrink-0"
        style={{ borderTop: "1px solid var(--border)" }}>
        <button onClick={onClose}
          className="text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}>
          Cancelar
        </button>
        <button onClick={handleSalvar} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><Check size={14} /> Salvar produto</>}
        </button>
      </div>
    </motion.div>
  )
}

// ─── Página ───────────────────────────────────────────────
export default function ProdutosPage() {
  const qc = useQueryClient()
  const [busca, setBusca]       = useState("")
  const [catFiltro, setCat]     = useState("")
  const [ordemCodigo, setOrdemCodigo] = useState<"asc" | "desc">("desc")
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

  const buscaDebounced = useDebounce(busca, 300)

  const { data, isLoading } = useQuery<{ data: Produto[]; total: number }>({
    queryKey: ["produtos", buscaDebounced, catFiltro, ordemCodigo],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: "9999", ordem_codigo: ordemCodigo, ...(buscaDebounced && { busca: buscaDebounced }), ...(catFiltro && { categoria_id: catFiltro }) }).toString()
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

  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = document.documentElement
    const handler = () => setScrolled(el.scrollTop > 120)
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

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
      cor: (p as unknown as { cor?: string }).cor ?? "",
      tamanho: (p as unknown as { tamanho?: string | null }).tamanho ?? "",
    })
    setEditInitStep(7)   // abre direto no resumo (step 7 = TOTAL)
    setWizard(true)
  }

  return (
    <div className="space-y-5 pt-3 sm:pt-6">
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
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, código ou marca"
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
          <table className="w-full min-w-[700px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider">
                  <button onClick={() => setOrdemCodigo(o => o === "asc" ? "desc" : "asc")}
                    className="flex items-center gap-1 transition-colors hover:opacity-100"
                    style={{ color: "var(--accent)" }}
                    title={ordemCodigo === "asc" ? "Ordenado: A→Z. Clique para Z→A" : "Ordenado: Z→A. Clique para A→Z"}>
                    <span>Código</span>
                    <span className="text-[11px]">{ordemCodigo === "asc" ? "↑" : "↓"}</span>
                  </button>
                </th>
                {["Produto", "Cor", "Tamanho", "Marca", "Categoria", "Preço Venda", "Preço Custo", "Estoque", "Ações"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center">
                  <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "var(--accent)" }} />
                </td></tr>
              ) : produtos.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center">
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
                  <td className="px-4 py-3">
                    {p.cor ? (() => {
                      const c = CORES_PRODUTO.find(x => x.nome === p.cor)
                      const isGrad = c?.hex.startsWith("linear") || c?.hex.startsWith("repeating")
                      const claro = ["BRANCO","OFF WHITE","NUDE","BEGE","PRATA","PÊSSEGO","FLORAL","AMARELO","LAVANDA"].includes(p.cor)
                      return (
                        <span className="flex items-center gap-1.5">
                          {c && (
                            <span className="w-3.5 h-3.5 rounded-full shrink-0 border"
                              style={{
                                background: isGrad ? c.hex : c.hex,
                                borderColor: claro ? "#94a3b8" : "transparent",
                              }} />
                          )}
                          <span className="text-xs uppercase" style={{ color: "var(--text-secondary)" }}>{p.cor}</span>
                        </span>
                      )
                    })() : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {(p as unknown as { tamanho?: string | null }).tamanho ? (
                      <span className="text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-wide"
                        style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.3)" }}>
                        {(p as unknown as { tamanho?: string | null }).tamanho}
                      </span>
                    ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
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

      {/* FAB flutuante — aparece ao rolar */}
      <AnimatePresence>
        {scrolled && !wizard && (
          <motion.button
            key="fab-novo-produto"
            initial={{ opacity: 0, scale: 0.5, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 24 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => { setEditForm(null); setEditId(null); setEditInitStep(1); setWizard(true) }}
            className="fixed bottom-8 right-8 z-40 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-white text-sm font-bold shadow-2xl"
            style={{
              background: "linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)",
              boxShadow: "0 8px 32px 0 rgba(109,40,217,0.45), 0 2px 8px 0 rgba(0,0,0,0.18)",
            }}>
            {/* Pulse ring */}
            <motion.span
              className="absolute inset-0 rounded-2xl"
              animate={{ scale: [1, 1.18], opacity: [0.35, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
              style={{ background: "var(--accent)", zIndex: -1 }}
            />
            <motion.span
              animate={{ rotate: [0, 90, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
              <Plus size={18} strokeWidth={2.5} />
            </motion.span>
            Novo Produto
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
