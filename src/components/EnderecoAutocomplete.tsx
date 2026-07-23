"use client"

import { useEffect, useRef, type CSSProperties, type RefObject } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Loader2, Check, MapPin, Users } from "lucide-react"
import { useEnderecoBusca } from "@/hooks/useEnderecoBusca"
import type { EnderecoSugestao } from "@/lib/endereco-parser"

export interface EnderecoEscolhido {
  cep:          string
  logradouro:   string
  bairro:       string
  cidade:       string
  estado:       string
  /** Número extraído da frase digitada ou vindo da própria sugestão. */
  numero:       string
  /** Complemento extraído da frase (APTO, CASA, BLOCO...). */
  complemento:  string
}

interface Props {
  /** Texto inicial do campo (ex.: endereço já salvo, ao editar). */
  textoInicial?: string
  placeholder?:  string
  inputRef?:     RefObject<HTMLInputElement | null>
  inputClassName?: string
  inputStyle?:   CSSProperties
  /** Marca o campo em verde e mostra o check. */
  confirmado?:   boolean
  onSelecionar: (end: EnderecoEscolhido) => void
  /** Chamado quando o campo é editado depois de já ter uma seleção. */
  onEditar?:    () => void
}

/**
 * Campo único de endereço: aceita CEP, nome de rua ou endereço completo
 * com número e complemento. A busca acontece no servidor
 * (`/api/enderecos/buscar`), que consulta primeiro os endereços já
 * cadastrados e só depois as fontes externas.
 */
export function EnderecoAutocomplete({
  textoInicial = "",
  placeholder = "Ex: 14085-520 · Rua Ceará 1687 Casa 57 · Av. Brasil 200 Apto 3",
  inputRef,
  inputClassName,
  inputStyle,
  confirmado = false,
  onSelecionar,
  onEditar,
}: Props) {
  const {
    texto, setTexto, definirTextoSemBuscar,
    sugestoes, buscando, aberto, fechar, reabrir, extrasRef,
  } = useEnderecoBusca()

  // Preenche o campo uma única vez com o valor que veio de fora.
  const semeado = useRef(false)
  useEffect(() => {
    if (!semeado.current && textoInicial) {
      semeado.current = true
      definirTextoSemBuscar(textoInicial)
    }
  }, [textoInicial, definirTextoSemBuscar])

  function escolher(s: EnderecoSugestao) {
    const { numero, complemento } = extrasRef.current
    onSelecionar({
      cep:         s.cep,
      logradouro:  s.logradouro,
      bairro:      s.bairro,
      cidade:      s.cidade,
      estado:      s.estado,
      // O número digitado na frase manda; o da sugestão é o reserva.
      numero:      numero || s.numero || "",
      complemento: complemento ? complemento.toUpperCase() : "",
    })
    definirTextoSemBuscar(
      [s.logradouro, s.bairro, s.cidade, s.estado, s.cep].filter(Boolean).join(", ")
    )
  }

  const semResultado =
    texto.trim().length > 3 && !buscando && sugestoes.length === 0 && !confirmado

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={texto}
        onChange={e => { setTexto(e.target.value); onEditar?.() }}
        onFocus={reabrir}
        onBlur={() => setTimeout(fechar, 180)}
        placeholder={placeholder}
        className={inputClassName}
        style={{
          ...inputStyle,
          borderColor: confirmado ? "#10b981" : (inputStyle?.borderColor ?? "var(--border)"),
        }}
        autoComplete="off"
      />

      {buscando && (
        <Loader2 size={18} className="animate-spin absolute right-4 top-1/2 -translate-y-1/2"
          style={{ color: "var(--accent)" }} />
      )}
      {confirmado && !buscando && (
        <Check size={18} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "#10b981" }} />
      )}

      <AnimatePresence>
        {aberto && sugestoes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute left-0 right-0 top-full mt-1 z-50 rounded-2xl shadow-xl overflow-hidden"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

            {sugestoes.length > 1 && (
              <div className="px-4 py-2 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {sugestoes.length} resultados encontrados
                </span>
                {sugestoes.some(s => s.fonte === "cadastro") && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                    Já cadastrado
                  </span>
                )}
              </div>
            )}

            <div style={{ maxHeight: "calc(3 * 68px)", overflowY: "auto" }}>
              {sugestoes.map((s, i) => {
                const doCadastro = s.fonte === "cadastro"
                return (
                  <button key={`${s.logradouro}-${s.cep}-${i}`} onMouseDown={() => escolher(s)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors"
                    style={{ borderBottom: i < sugestoes.length - 1 ? "1px solid var(--border)" : "none" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-surface)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>

                    {doCadastro
                      ? <Users size={14} className="mt-0.5 shrink-0" style={{ color: "#10b981" }} />
                      : <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {[s.logradouro, s.numero, s.bairro].filter(Boolean).join(", ")}
                        </p>
                        {doCadastro && (s.ocorrencias ?? 0) > 1 && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                            {s.ocorrencias} clientes
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                        {[s.cidade, s.estado, s.cep].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {semResultado && (
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Nenhum endereço encontrado — você poderá preencher manualmente na próxima etapa.
        </p>
      )}
    </div>
  )
}
