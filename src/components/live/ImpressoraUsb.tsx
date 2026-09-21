"use client"

// Botões de impressão direta por cabo USB. Ver `lib/impressora-usb.ts`.

import { useEffect, useRef, useState } from "react"
import { Copy, Loader2, Search, Usb } from "lucide-react"
import { etiquetaParaPontos, PNG_PX } from "@/lib/etiqueta-export"
import {
  MODOS, conectar, desconectar, enviar, investigar, modoSalvo, montarComando,
  nomeDaImpressora, pontosDeTeste, reconectar, salvarModo, usbDisponivel,
  type Conexao, type ModoImpressora,
} from "@/lib/impressora-usb"

const estiloBotao = {
  background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)",
} as const

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function ImpressoraUsb({
  nosDaFolha, onImpresso,
}: {
  nosDaFolha: () => HTMLElement[]
  /** Chamado só depois que TODAS as etiquetas foram enviadas. */
  onImpresso: () => void
}) {
  const [suportado, setSuportado] = useState(false)
  const [conexao, setConexao] = useState<Conexao | null>(null)
  const [modo, setModo] = useState<ModoImpressora>("tspl")
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState("")
  const [relatorio, setRelatorio] = useState("")
  const [rodadaFeita, setRodadaFeita] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const conexaoRef = useRef<Conexao | null>(null)

  useEffect(() => {
    // Lido depois da montagem (assíncrono) para não divergir do HTML do servidor.
    Promise.resolve().then(() => {
      setSuportado(usbDisponivel())
      setModo(modoSalvo())
    })
    reconectar().then((c) => {
      if (c) { conexaoRef.current = c; setConexao(c) }
    })
    return () => { if (conexaoRef.current) void desconectar(conexaoRef.current) }
  }, [])

  async function tarefa(nome: string, fn: () => Promise<void>) {
    setErro("")
    setOcupado(nome)
    try { await fn() }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha ao falar com a impressora.") }
    finally { setOcupado(null) }
  }

  if (!suportado) return null

  const escolher = (m: ModoImpressora) => { setModo(m); salvarModo(m) }
  const { largura, altura } = { largura: PNG_PX.largura, altura: PNG_PX.altura }

  const conectarAgora = () => tarefa("conectar", async () => {
    const c = await conectar()
    conexaoRef.current = c
    setConexao(c)
  })

  const testar = () => tarefa("teste", async () => {
    if (!conexao) return
    await enviar(conexao, montarComando(modo, pontosDeTeste(largura, altura), largura, altura))
  })

  /** Manda uma etiqueta de teste por linguagem; o nº de quadrados diz qual saiu. */
  const testarTodas = () => tarefa("todas", async () => {
    if (!conexao) return
    setRodadaFeita(false)
    for (let i = 0; i < MODOS.length; i++) {
      try {
        await enviar(conexao, montarComando(MODOS[i].id, pontosDeTeste(largura, altura, i + 1), largura, altura))
      } catch { /* uma linguagem recusada não pode impedir as demais */ }
      await espera(2500)
    }
    setRodadaFeita(true)
  })

  const investigarAgora = () => tarefa("investigar", async () => {
    if (!conexao) return
    setRelatorio(await investigar(conexao))
  })

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(relatorio)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* o texto continua selecionável na caixa */ }
  }

  const imprimirTudo = () => tarefa("imprimir", async () => {
    if (!conexao) return
    const nos = nosDaFolha()
    if (nos.length === 0) return
    for (const no of nos) {
      const { largura: l, altura: a, preto } = await etiquetaParaPontos(no)
      await enviar(conexao, montarComando(modo, preto, l, a))
    }
    onImpresso()
  })

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {!conexao ? (
          <button
            onClick={conectarAgora} disabled={ocupado !== null}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-40"
            style={estiloBotao}
          >
            {ocupado === "conectar" ? <Loader2 size={15} className="animate-spin"/> : <Usb size={15}/>}
            Conectar impressora USB
          </button>
        ) : (
          <>
            <button
              onClick={imprimirTudo} disabled={ocupado !== null}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-40"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {ocupado === "imprimir" ? <Loader2 size={15} className="animate-spin"/> : <Usb size={15}/>}
              {ocupado === "imprimir" ? "Enviando…" : `Imprimir direto (${nomeDaImpressora(conexao)})`}
            </button>
            <select
              value={modo} onChange={(e) => escolher(e.target.value as ModoImpressora)}
              className="px-2 py-2.5 rounded-xl text-[12px] font-semibold" style={estiloBotao}
              title="Linguagem usada para falar com a impressora"
            >
              {MODOS.map((m, i) => <option key={m.id} value={m.id}>{i + 1}. {m.nome}</option>)}
            </select>
            <button
              onClick={testar} disabled={ocupado !== null}
              className="px-3 py-2.5 rounded-xl text-[12px] font-semibold disabled:opacity-40" style={estiloBotao}
            >
              {ocupado === "teste" ? "Enviando…" : "Etiqueta de teste"}
            </button>
            <button
              onClick={testarTodas} disabled={ocupado !== null}
              className="px-3 py-2.5 rounded-xl text-[12px] font-semibold disabled:opacity-40" style={estiloBotao}
              title="Manda uma etiqueta por linguagem. Quantos quadrados saíram no topo diz qual funcionou."
            >
              {ocupado === "todas" ? "Testando…" : "Testar todas as linguagens"}
            </button>
            <button
              onClick={investigarAgora} disabled={ocupado !== null}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-semibold disabled:opacity-40" style={estiloBotao}
              title="Pergunta à impressora quem ela é e gera um relatório para enviar"
            >
              {ocupado === "investigar" ? <Loader2 size={13} className="animate-spin"/> : <Search size={13}/>}
              Investigar impressora
            </button>
          </>
        )}
        {erro && <span className="text-[12px]" style={{ color: "#f87171" }}>{erro}</span>}
      </div>

      {rodadaFeita && (
        <div className="mt-2 rounded-xl p-3 text-[12px]" style={estiloBotao}>
          <div className="mb-2 font-semibold">Quantos quadrados pretos saíram no topo da etiqueta que imprimiu?</div>
          <div className="flex flex-wrap gap-2">
            {MODOS.map((m, i) => (
              <button
                key={m.id}
                onClick={() => { escolher(m.id); setRodadaFeita(false) }}
                className="px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {i + 1} — {m.nome}
              </button>
            ))}
            <button onClick={() => setRodadaFeita(false)} className="px-3 py-1.5 rounded-lg" style={estiloBotao}>
              Nenhuma saiu
            </button>
          </div>
        </div>
      )}

      {relatorio && (
        <div className="mt-2 rounded-xl p-3" style={estiloBotao}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold">Relatório da impressora — copie e envie</span>
            <button onClick={copiar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
              style={{ background: "var(--accent)", color: "#fff" }}>
              <Copy size={12}/> {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <textarea
            readOnly value={relatorio} rows={12}
            className="w-full text-[11px] font-mono rounded-lg p-2"
            style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
        </div>
      )}
    </div>
  )
}
