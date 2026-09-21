"use client"

// ══════════════════════════════════════════════════════════════════
// Impressão das etiquetas de sacola da live.
//
// Abre depois do disparo, mas continua acessível pela página da live
// para sempre: o lote é REMONTADO a partir das compras toda vez, então
// fechar a aba sem querer não perde nada — reabrir produz exatamente
// as mesmas etiquetas, nos mesmos pares.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import {
  AlertTriangle, Check, Download, FileText, ImageIcon, Loader2, Printer,
  Ruler, Tag, X,
} from "lucide-react"
import { apiGet, apiPost } from "@/services/api"
import { baixarEtiquetaPNG, baixarEtiquetasPDF, PNG_PX } from "@/lib/etiqueta-export"
import {
  excedeEtiquetaInteira, montarEtiquetas, resumirLote,
  type SacolaEtiqueta,
} from "@/lib/etiqueta-sacola"
import ImpressoraUsb from "./ImpressoraUsb"
import EtiquetaSacola,{ type LojaEtiqueta } from "./EtiquetaSacola"
import { useEscClose } from "@/lib/useEscClose"

interface SacolaResposta extends SacolaEtiqueta {
  impressaEm: string | null
  /** Compra gravada com total zerado apesar de ter itens com preço. */
  totalDivergente?: boolean
}

interface RespostaEtiquetas {
  ok: boolean
  live: { id: number; data_live: string | null; status: string }
  loja: LojaEtiqueta
  sacolas: SacolaResposta[]
}

/** Reduz os cartões na grade sem mexer no tamanho real da etiqueta. */
const ESCALA_GRADE = 0.72

export default function EtiquetasSacolaModal({
  liveId,
  onFechar,
}: {
  liveId: number
  onFechar: () => void
}) {
  const qc = useQueryClient()
  const [incluirImpressas, setIncluirImpressas] = useState(false)
  const [mostrarGuia, setMostrarGuia] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [exportando, setExportando] = useState<string | null>(null)
  const [erroExport, setErroExport] = useState("")
  const folhaRef = useRef<HTMLDivElement>(null)

  useEscClose(onFechar)

  const { data, isLoading, error } = useQuery<RespostaEtiquetas>({
    queryKey: ["etiquetas-sacola", liveId],
    queryFn: () => apiGet<RespostaEtiquetas>(`/live/${liveId}/etiquetas-sacola`),
  })

  const loja: LojaEtiqueta = data?.loja ?? { nome: "Brechó Bellasu" }

  const sacolas = useMemo(() => {
    const todas = data?.sacolas ?? []
    return incluirImpressas ? todas : todas.filter((s) => !s.impressaEm)
  }, [data?.sacolas, incluirImpressas])

  const etiquetas = useMemo(() => montarEtiquetas(sacolas), [sacolas])
  const resumo = useMemo(() => resumirLote(etiquetas, sacolas), [etiquetas, sacolas])

  const jaImpressas = (data?.sacolas ?? []).filter((s) => s.impressaEm).length
  const excedentes = useMemo(() => sacolas.filter(excedeEtiquetaInteira), [sacolas])
  const divergentes = useMemo(() => sacolas.filter(s => s.totalDivergente), [sacolas])
  // Dois blocos com o mesmo numerão na bancada é confusão garantida.
  const numerosRepetidos = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const s of sacolas) {
      if (!s.numeroSacola) continue
      contagem.set(s.numeroSacola, (contagem.get(s.numeroSacola) ?? 0) + 1)
    }
    return [...contagem.entries()].filter(([, n]) => n > 1).map(([n]) => n)
  }, [sacolas])

  const marcar = useMutation({
    mutationFn: (ids: number[]) =>
      apiPost(`/live/${liveId}/etiquetas-sacola`, { compra_ids: ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etiquetas-sacola", liveId] })
      qc.invalidateQueries({ queryKey: ["live", liveId] })
      setConfirmando(false)
    },
  })

  /** Nós das etiquetas na folha oculta — é dali que saem PDF e PNG. */
  const nosDaFolha = useCallback((): HTMLElement[] => {
    const raiz = folhaRef.current
    if (!raiz) return []
    return Array.from(raiz.querySelectorAll<HTMLElement>(".etiqueta-folha"))
  }, [])

  const sufixo = useMemo(() => {
    const d = data?.live?.data_live
    return d ? d.replaceAll("-", "") : String(liveId)
  }, [data?.live?.data_live, liveId])

  async function exportar(tarefa: string, acao: () => Promise<void>) {
    setErroExport("")
    setExportando(tarefa)
    try {
      await acao()
    } catch (e) {
      setErroExport(e instanceof Error ? e.message : "Falha ao gerar o arquivo.")
    } finally {
      setExportando(null)
    }
  }

  function imprimir() {
    if (etiquetas.length === 0) return
    window.print()
    // A confirmação vem DEPOIS do diálogo, e nunca antes: clicar em
    // imprimir não prova que o papel saiu. Se a impressora estiver
    // desconectada, marcar aqui sumiria com o lote inteiro da lista.
    setConfirmando(true)
  }

  // Também cobre o Ctrl+P do teclado e o modo quiosque do Chrome, que
  // imprime sem abrir diálogo nenhum.
  useEffect(() => {
    const aoImprimir = () => setConfirmando(true)
    window.addEventListener("afterprint", aoImprimir)
    return () => window.removeEventListener("afterprint", aoImprimir)
  }, [])

  const idsVisiveis = sacolas.map((s) => s.compraId)

  return (
    <>
      {/* ══ A FOLHA QUE VAI PARA O PAPEL ══
          Fica fora da vista o tempo todo; o @media print faz o resto da
          tela sumir e só ela aparecer, em tamanho real. */}
      <div ref={folhaRef} className="folha-impressao">
        {etiquetas.map((et) => (
          <EtiquetaSacola key={et.indice} etiqueta={et} loja={loja}/>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 overflow-y-auto"
        style={{ background: "rgba(6,8,12,.86)", backdropFilter: "blur(3px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: .985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="mx-auto max-w-[1180px] px-4 sm:px-6 py-6"
        >
          {/* ── CABEÇALHO ── */}
          <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <Tag size={15} style={{ color: "var(--accent)" }}/>
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    Etiquetas das sacolas
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black leading-tight" style={{ color: "var(--text-primary)" }}>
                  {isLoading
                    ? "Montando o lote…"
                    : `${resumo.sacolas} sacola${resumo.sacolas === 1 ? "" : "s"} em ${resumo.etiquetas} etiqueta${resumo.etiquetas === 1 ? "" : "s"}`}
                </h2>
                {!isLoading && resumo.sacolas > 0 && (
                  <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {resumo.pares} par{resumo.pares === 1 ? "" : "es"} · {resumo.sozinhas} sozinha{resumo.sozinhas === 1 ? "" : "s"}
                    {resumo.economia > 0 && ` · economia de ${resumo.economia} etiqueta${resumo.economia === 1 ? "" : "s"}`}
                  </p>
                )}
              </div>

              <motion.button
                onClick={onFechar} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: .9 }}
                className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                aria-label="Fechar"
              >
                <X size={16}/>
              </motion.button>
            </div>

            {/* ── AÇÕES ── */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <motion.button
                onClick={imprimir} disabled={etiquetas.length === 0}
                whileHover={etiquetas.length > 0 ? { scale: 1.03, y: -1 } : {}}
                whileTap={etiquetas.length > 0 ? { scale: .97 } : {}}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                <Printer size={15}/>
                Imprimir {etiquetas.length > 0 && `as ${etiquetas.length}`}
              </motion.button>

              <motion.button
                onClick={() => exportar("lote", () =>
                  baixarEtiquetasPDF(nosDaFolha(), `etiquetas-live-${sufixo}.pdf`))}
                disabled={etiquetas.length === 0 || exportando !== null}
                whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: .97 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-40"
                style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                {exportando === "lote" ? <Loader2 size={15} className="animate-spin"/> : <Download size={15}/>}
                {exportando === "lote" ? "Gerando…" : "Baixar lote em PDF"}
              </motion.button>

              <div className="flex-1"/>

              {jaImpressas > 0 && (
                <button
                  onClick={() => setIncluirImpressas(v => !v)}
                  className="px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors"
                  style={{
                    background: incluirImpressas ? "var(--bg-surface)" : "transparent",
                    color: incluirImpressas ? "var(--text-primary)" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {incluirImpressas ? "Ocultar" : "Mostrar"} {jaImpressas} já impressa{jaImpressas === 1 ? "" : "s"}
                </button>
              )}

              <button
                onClick={() => setMostrarGuia(v => !v)}
                title="Linha da margem de segurança — nada pode encostar nela"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors"
                style={{
                  background: mostrarGuia ? "rgba(220,38,38,.12)" : "transparent",
                  color: mostrarGuia ? "#f87171" : "var(--text-muted)",
                  border: `1px solid ${mostrarGuia ? "rgba(220,38,38,.35)" : "var(--border)"}`,
                }}
              >
                <Ruler size={13}/> Margem de segurança
              </button>
            </div>
            <ImpressoraUsb nosDaFolha={nosDaFolha} onImpresso={() => setConfirmando(true)}/>
          </div>

          {/* ── AVISOS ── */}
          <AnimatePresence>
            {!isLoading && resumo.semEndereco > 0 && (
              <Aviso
                chave="sem-endereco"
                texto={`${resumo.semEndereco} sacola${resumo.semEndereco === 1 ? "" : "s"} sem endereço cadastrado.`}
                detalhe="A etiqueta sai com a linha do endereço em branco. Complete o cadastro da cliente ou imprima assim mesmo."
              />
            )}
            {!isLoading && excedentes.length > 0 && (
              <Aviso
                chave="excedentes"
                texto={`${excedentes.length} sacola${excedentes.length === 1 ? "" : "s"} com itens demais para uma etiqueta.`}
                detalhe={`Sacola${excedentes.length === 1 ? "" : "s"} ${excedentes.map(s => s.numeroSacola ?? "?").join(", ")} — a lista foi dividida em mais de uma etiqueta (1/2, 2/2).`}
              />
            )}
            {!isLoading && divergentes.length > 0 && (
              <Aviso
                chave="divergentes"
                texto={`${divergentes.length} sacola${divergentes.length === 1 ? "" : "s"} com o total da compra zerado.`}
                detalhe={`Sacola${divergentes.length === 1 ? "" : "s"} ${divergentes.map(s => s.numeroSacola ?? "?").join(", ")} — a etiqueta está imprimindo a soma das peças para não sair "R$ 0,00" embaixo de uma lista com preço. Vale conferir o valor da compra.`}
              />
            )}
            {!isLoading && numerosRepetidos.length > 0 && (
              <Aviso
                chave="repetidos"
                texto={`Número de sacola repetido: ${numerosRepetidos.join(", ")}.`}
                detalhe="Duas sacolas diferentes vão sair com o mesmo número grande, e na bancada não tem como diferenciar. Vale renumerar antes de imprimir."
              />
            )}
            {erroExport && (
              <Aviso chave="erro-export" texto="Falha ao gerar o arquivo." detalhe={erroExport}/>
            )}
          </AnimatePresence>

          {/* ── CORPO ── */}
          {isLoading ? (
            <Esqueleto/>
          ) : error ? (
            <Vazio
              titulo="Não foi possível carregar as etiquetas"
              texto={error instanceof Error ? error.message : "Tente novamente em instantes."}
            />
          ) : etiquetas.length === 0 ? (
            <Vazio
              titulo={jaImpressas > 0 ? "Todas as etiquetas já foram impressas" : "Nenhuma sacola para imprimir"}
              texto={
                jaImpressas > 0
                  ? `As ${jaImpressas} sacolas desta live já saíram no papel. Para reimprimir alguma, mostre as já impressas acima.`
                  : "Assim que houver compras registradas nesta live, as etiquetas aparecem aqui."
              }
            />
          ) : (
            <div className="flex flex-wrap gap-4">
              {etiquetas.map((et, i) => {
                const impressa = et.blocos.every(b => (b as SacolaResposta).impressaEm)
                const numeros = et.blocos.map(b => b.numeroSacola ?? "?").join(" + ")
                return (
                  <motion.div
                    key={et.indice}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.4), type: "spring", stiffness: 300, damping: 28 }}
                    whileHover={{ y: -3 }}
                    className="group rounded-2xl p-3"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="text-[12.5px] font-bold" style={{ color: "var(--text-primary)" }}>
                        Etiqueta {et.indice}
                        <span className="font-normal" style={{ color: "var(--text-muted)" }}>
                          {" "}· sacola{et.blocos.length > 1 ? "s" : ""} {numeros}
                        </span>
                        {et.modo === "solo" && (
                          <span
                            className="ml-2 text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ color: "#fbbf24", border: "1px solid rgba(251,191,36,.35)" }}
                          >
                            sozinha
                          </span>
                        )}
                        {impressa && (
                          <span
                            className="ml-2 inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ color: "#34d399", border: "1px solid rgba(52,211,153,.35)" }}
                          >
                            <Check size={9}/> impressa
                          </span>
                        )}
                      </div>

                      {/* Botões discretos: aparecem no hover para não poluir a grade. */}
                      <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <BotaoMini
                          carregando={exportando === `pdf-${et.indice}`}
                          onClick={() => exportar(`pdf-${et.indice}`, () =>
                            baixarEtiquetasPDF([nosDaFolha()[i]], `etiqueta-${numeros.replaceAll(" + ", "-")}.pdf`))}
                          icone={<FileText size={11}/>} rotulo="PDF"
                        />
                        <BotaoMini
                          carregando={exportando === `png-${et.indice}`}
                          onClick={() => exportar(`png-${et.indice}`, () =>
                            baixarEtiquetaPNG(nosDaFolha()[i], `etiqueta-${numeros.replaceAll(" + ", "-")}.png`))}
                          icone={<ImageIcon size={11}/>} rotulo="PNG"
                        />
                      </div>
                    </div>

                    {/* A etiqueta é reduzida só para caber na grade; o
                        arquivo e a impressão saem em tamanho real. */}
                    <div style={{
                      width: `calc(100mm * ${ESCALA_GRADE})`,
                      height: `calc(147mm * ${ESCALA_GRADE})`,
                      overflow: "hidden",
                    }}>
                      <div style={{ transform: `scale(${ESCALA_GRADE})`, transformOrigin: "top left" }}>
                        <EtiquetaSacola etiqueta={et} loja={loja} mostrarGuia={mostrarGuia}/>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          <p className="text-[11.5px] mt-5 text-center" style={{ color: "var(--text-muted)" }}>
            Etiqueta 100 × 147 mm · BY-480BT a 203 dpi · PNG exportado em {PNG_PX.largura} × {PNG_PX.altura} px,
            um pixel por ponto da impressora.
          </p>
        </motion.div>
      </motion.div>

      {/* ── CONFIRMAÇÃO DE IMPRESSÃO ── */}
      <AnimatePresence>
        {confirmando && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: "rgba(6,8,12,.75)" }}
          >
            <motion.div
              initial={{ opacity: 0, scale: .94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: .96, y: 8 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="w-full max-w-[440px] rounded-2xl p-6"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <h3 className="text-[17px] font-black mb-2" style={{ color: "var(--text-primary)" }}>
                {etiquetas.length === 1
                  ? "A etiqueta saiu corretamente?"
                  : `As ${etiquetas.length} etiquetas saíram corretamente?`}
              </h3>
              <p className="text-[13px] leading-relaxed mb-5" style={{ color: "var(--text-muted)" }}>
                Só confirme depois de conferir o papel. Se a impressora falhou, mantenha na lista
                e baixe o PDF — as sacolas continuam aqui esperando.
              </p>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  onClick={() => marcar.mutate(idsVisiveis)}
                  disabled={marcar.isPending}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  {marcar.isPending ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
                  Sim, marcar como impressas
                </motion.button>
                <motion.button
                  onClick={() => setConfirmando(false)}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-bold"
                  style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                >
                  Não, manter na lista
                </motion.button>
              </div>
              {marcar.isError && (
                <p className="text-[12px] mt-3" style={{ color: "#f87171" }}>
                  {marcar.error instanceof Error ? marcar.error.message : "Falha ao registrar."}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Peças de apoio ──────────────────────────────────────────────

function BotaoMini({
  onClick, icone, rotulo, carregando,
}: {
  onClick: () => void
  icone: React.ReactNode
  rotulo: string
  carregando: boolean
}) {
  return (
    <motion.button
      onClick={onClick} disabled={carregando}
      whileHover={{ scale: 1.06 }} whileTap={{ scale: .94 }}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-bold"
      style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
    >
      {carregando ? <Loader2 size={11} className="animate-spin"/> : icone}
      {rotulo}
    </motion.button>
  )
}

function Aviso({ chave, texto, detalhe }: { chave: string; texto: string; detalhe: string }) {
  return (
    <motion.div
      key={chave}
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden mb-3"
    >
      <div
        className="rounded-xl px-4 py-3 flex items-start gap-2.5"
        style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.28)" }}
      >
        <AlertTriangle size={15} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }}/>
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <b style={{ color: "#f59e0b" }}>{texto}</b> {detalhe}
        </p>
      </div>
    </motion.div>
  )
}

function Esqueleto() {
  return (
    <div className="flex flex-wrap gap-4">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ opacity: [.45, .8, .45] }}
          transition={{ repeat: Infinity, duration: 1.6, delay: i * .18 }}
          className="rounded-2xl"
          style={{
            width: `calc(100mm * ${ESCALA_GRADE} + 24px)`,
            height: `calc(147mm * ${ESCALA_GRADE} + 58px)`,
            background: "var(--bg-card)", border: "1px solid var(--border)",
          }}
        />
      ))}
    </div>
  )
}

function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl py-14 px-6 text-center"
      style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}
    >
      <motion.div
        animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <Tag size={22} style={{ color: "var(--text-muted)" }}/>
      </motion.div>
      <h3 className="text-[15px] font-black mb-1.5" style={{ color: "var(--text-primary)" }}>{titulo}</h3>
      <p className="text-[12.5px] max-w-[420px] mx-auto leading-relaxed" style={{ color: "var(--text-muted)" }}>{texto}</p>
    </motion.div>
  )
}
