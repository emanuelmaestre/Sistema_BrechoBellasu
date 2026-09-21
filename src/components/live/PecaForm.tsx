"use client"

// Cartão de cadastro da peça digitada na hora — o MESMO formulário na live e
// nas vendas: nome, cor, quantidade, preço original, preço praticado e o
// desconto calculado ao vivo. Não há catálogo: a peça nasce aqui.
import type { RefObject } from "react"
import { motion } from "motion/react"
import { Package, TrendingUp, X } from "lucide-react"
import productData from "@/data/catalog/products.json"
import { fmtBRL } from "@/lib/utils"
import { parsePrecoBR, formatarPrecoBR, descontoPct } from "@/lib/peca"

// Paleta de cores das peças — a bolinha colorida é o que diferencia
// peças genéricas de relance na hora de separar a sacola.
export const CORES_PECA: { nome: string; hex: string }[] = productData.colors

/** Bolinha da cor + nome, para exibir a cor escolhida na paleta em listas. */
export function CorTag({ cor }: { cor?: string | null }) {
  const nome = (cor ?? "").trim().toUpperCase()
  if (!nome) return null
  const hex = CORES_PECA.find(c => c.nome === nome)?.hex ?? "transparent"
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide align-middle"
      style={{ color: "var(--text-muted)" }}>
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: hex, border: "1px solid var(--border)" }}/>
      {nome}
    </span>
  )
}

export interface PecaFormValores {
  nome_produto: string
  cor: string
  quantidade: string
  preco_original: string
  preco_live: string
}

export const PECA_FORM_VAZIO: PecaFormValores = {
  nome_produto: "", cor: "", quantidade: "1", preco_original: "", preco_live: "",
}

// Cor da peça: seleção pura, sem campo de digitação. Em live a mão está no
// dedo/mouse e um toque é mais rápido que teclar — e texto livre gerava três
// grafias para a mesma cor ("salmao", "Salmão", "SALMAO").
//
// A paleta inteira fica visível de uma vez, sem corte: quando ela ficava numa
// caixinha baixa e rolável parecia que o sistema só tinha 10 cores.
export function SeletorCor({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const atual = valor.trim().toUpperCase()
  const naPaleta = CORES_PECA.some(c => c.nome === atual)
  // Peça antiga pode ter cor digitada à mão, de antes da paleta. Ela entra na
  // lista já selecionada para a edição não apagar em silêncio o que foi gravado.
  const lista = atual && !naPaleta ? [{ nome: atual, hex: "transparent" }, ...CORES_PECA] : CORES_PECA
  const selecionada = CORES_PECA.find(c => c.nome === atual)

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
      {/* Barra de estado: mostra a escolha sem precisar caçar o chip aceso no
          meio de 78, e é onde fica o limpar. */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 sticky top-0 z-10"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
        {atual ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-4 h-4 rounded-full shrink-0"
              style={{ background: selecionada?.hex ?? "transparent", border: "1px solid var(--border)" }}/>
            <span className="text-xs font-black uppercase tracking-wide truncate" style={{ color: "var(--text-primary)" }}>{atual}</span>
          </span>
        ) : (
          <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
            Escolha a cor · {CORES_PECA.length} disponíveis
          </span>
        )}
        {atual && (
          <motion.button type="button" onClick={() => onChange("")} whileTap={{ scale: 0.9 }}
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-lg shrink-0"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            <X size={10}/> Limpar
          </motion.button>
        )}
      </div>

      {/* Sem max-height: a paleta inteira aparece e a tela já rola sozinha.
          Cortar aqui foi o que fez parecer que faltavam cores. */}
      <div className="flex items-center gap-1.5 flex-wrap p-2.5">
        {lista.map(c => {
          const ativa = c.nome === atual
          return (
            <motion.button key={c.nome} type="button" aria-pressed={ativa}
              onClick={() => onChange(ativa ? "" : c.nome)}
              whileTap={{ scale: 0.9 }}
              title={c.nome}
              className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide shrink-0 transition-colors"
              style={{
                background: ativa ? "var(--accent)" : "var(--bg-card)",
                border: `1px solid ${ativa ? "var(--accent)" : "var(--border)"}`,
                color: ativa ? "#fff" : "var(--text-muted)",
              }}>
              <span className="w-4 h-4 rounded-full shrink-0"
                style={{ background: c.hex, border: `1px solid ${ativa ? "rgba(255,255,255,0.5)" : "var(--border)"}` }}/>
              {c.nome}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

interface PecaFormProps {
  form: PecaFormValores
  /** Recebe só o que mudou; quem usa faz o merge no próprio estado. */
  onChange: (patch: Partial<PecaFormValores>) => void
  nomeRef?: RefObject<HTMLInputElement | null>
  /** Rótulo do preço praticado: "LIVE" na live, "VENDA" nas vendas. */
  rotuloPreco?: string
  /** Chamado ao apertar Enter no nome (atalho para adicionar). */
  onEnter?: () => void
}

export default function PecaForm({ form, onChange, nomeRef, rotuloPreco = "LIVE", onEnter }: PecaFormProps) {
  const orig = parsePrecoBR(form.preco_original)
  const praticado = parsePrecoBR(form.preco_live)
  const disc = descontoPct(orig, praticado)

  // Ao sair do campo o valor vira "1.234,50", igual ao que aparece na lista.
  function normalizar(campo: "preco_original" | "preco_live") {
    const n = parsePrecoBR(form[campo])
    if (n > 0) onChange({ [campo]: formatarPrecoBR(n) })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="rounded-2xl overflow-hidden"
      style={{ border: "1.5px solid var(--accent)", background: "var(--accent-bg)" }}>
      {/* Header do card */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <motion.div initial={{ rotate: -15, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 16 }}
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--accent)", boxShadow: "0 2px 8px var(--accent-bg)" }}>
          <Package size={15} color="#fff"/>
        </motion.div>
        <div className="flex flex-col min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wide truncate"
            style={{ color: "var(--accent)" }}>Nova peça</p>
        </div>
      </div>

      {/* Nome e cor da peça — sem isto toda cliente recebe a mesma
          descrição genérica, inclusive na mensagem do WhatsApp. */}
      <div className="px-4 pb-3 space-y-2.5">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>NOME DA PEÇA</p>
          <input ref={nomeRef} value={form.nome_produto} maxLength={60}
            onChange={e => onChange({ nome_produto: e.target.value })}
            onKeyDown={e => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter() } }}
            placeholder="Ex.: Vestido midi floral"
            className="w-full px-3 py-2.5 text-sm font-bold rounded-xl outline-none border-2 transition-all focus:border-[color:var(--accent)]"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>COR</p>
          <SeletorCor valor={form.cor} onChange={v => onChange({ cor: v })}/>
        </div>
      </div>

      <div className="px-4 pb-4 grid grid-cols-3 gap-2.5">
        {/* QTD */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>QTD</p>
          <input type="number" step="1" min="1" value={form.quantidade} placeholder="1"
            onChange={e => onChange({ quantidade: e.target.value })}
            className="w-full px-3 py-2.5 text-sm font-bold rounded-xl outline-none border-2 transition-all focus:border-[color:var(--accent)] text-center"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
        </div>
        {/* Preço original */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>ORIGINAL</p>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black" style={{ color: "var(--text-muted)" }}>R$</span>
            <input value={form.preco_original} inputMode="decimal"
              onChange={e => onChange({ preco_original: e.target.value })}
              onBlur={() => normalizar("preco_original")}
              placeholder="0,00"
              className="w-full pl-8 pr-2 py-2.5 text-sm font-bold rounded-xl outline-none border-2 transition-all focus:border-[color:var(--accent)]"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}/>
          </div>
        </div>
        {/* Preço praticado */}
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{rotuloPreco}</p>
            <span className="text-[8px] font-black px-1 rounded" style={{ background: "var(--accent)", color: "#fff" }}>★</span>
          </div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black" style={{ color: "var(--accent)" }}>R$</span>
            <input value={form.preco_live} inputMode="decimal"
              onChange={e => onChange({ preco_live: e.target.value })}
              onBlur={() => normalizar("preco_live")}
              onKeyDown={e => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter() } }}
              placeholder="0,00"
              className="w-full pl-8 pr-2 py-2.5 text-sm font-bold rounded-xl outline-none border-2 transition-all focus:border-[color:var(--accent)]"
              style={{ background: "var(--bg-surface)", borderColor: "var(--accent)", color: "var(--text-primary)" }}/>
          </div>
        </div>
      </div>

      {/* Linha de desconto calculado ao vivo */}
      {disc > 0 && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
          className="px-4 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <TrendingUp size={12} style={{ color: "#10b981" }}/>
            <span className="text-[11px] font-black" style={{ color: "#10b981" }}>
              Desconto de {disc}% · economia de {fmtBRL(orig - praticado)}
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
