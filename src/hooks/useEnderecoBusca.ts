"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { apiClient } from "@/services/api"
import type { EnderecoSugestao } from "@/lib/endereco-parser"

interface RespostaBusca {
  sugestoes:   EnderecoSugestao[]
  numero:      string
  complemento: string
  cache?:      boolean
}

const DEBOUNCE_MS = 320

/**
 * Autocomplete de endereço — compartilhado por Clientes e Etiquetas.
 *
 * Duas proteções que faltavam na versão antiga:
 *  • `AbortController` cancela a requisição em voo, não só o timer;
 *  • um contador de sequência descarta respostas antigas que chegarem
 *    depois de uma busca mais nova (a resposta de "RUA CEA" não
 *    sobrescreve mais a de "RUA CEARÁ").
 */
export function useEnderecoBusca() {
  const [texto, setTextoState] = useState("")
  const [sugestoes, setSugestoes] = useState<EnderecoSugestao[]>([])
  const [buscando, setBuscando] = useState(false)
  const [aberto, setAberto] = useState(false)

  // Número e complemento extraídos da frase digitada, injetados no
  // formulário quando a pessoa escolhe uma sugestão.
  const extras = useRef<{ numero: string; complemento: string }>({ numero: "", complemento: "" })

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seqRef   = useRef(0)

  const cancelar = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
  }, [])

  useEffect(() => cancelar, [cancelar])

  const buscar = useCallback((valor: string) => {
    cancelar()
    const seq = ++seqRef.current

    if (valor.trim().length < 3) {
      setSugestoes([]); setAberto(false); setBuscando(false)
      return
    }

    setBuscando(true)

    timerRef.current = setTimeout(async () => {
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const { data } = await apiClient.get<RespostaBusca>("/enderecos/buscar", {
          params: { q: valor },
          signal: ctrl.signal,
        })
        // Chegou tarde: já existe uma busca mais nova em andamento.
        if (seq !== seqRef.current) return

        extras.current = { numero: data.numero ?? "", complemento: data.complemento ?? "" }
        setSugestoes(data.sugestoes ?? [])
        setAberto((data.sugestoes ?? []).length > 0)
      } catch {
        if (seq !== seqRef.current) return
        setSugestoes([]); setAberto(false)
      } finally {
        if (seq === seqRef.current) setBuscando(false)
      }
    }, DEBOUNCE_MS)
  }, [cancelar])

  /** Handler direto para o onChange do input. */
  const setTexto = useCallback((valor: string) => {
    setTextoState(valor)
    setSugestoes([])
    setAberto(false)
    buscar(valor)
  }, [buscar])

  /** Define o texto sem disparar busca (ex.: ao escolher uma sugestão). */
  const definirTextoSemBuscar = useCallback((valor: string) => {
    cancelar()
    seqRef.current++          // invalida qualquer resposta pendente
    setTextoState(valor)
    setSugestoes([])
    setAberto(false)
    setBuscando(false)
  }, [cancelar])

  const fechar = useCallback(() => setAberto(false), [])
  const reabrir = useCallback(() => { if (sugestoes.length > 0) setAberto(true) }, [sugestoes.length])

  return {
    texto, setTexto, definirTextoSemBuscar,
    sugestoes, buscando, aberto, fechar, reabrir,
    /** Leia `.current` só dentro de handlers, nunca durante o render. */
    extrasRef: extras,
  }
}
