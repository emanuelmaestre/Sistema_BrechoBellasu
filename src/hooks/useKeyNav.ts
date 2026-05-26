import { useState, useCallback } from "react"

/** Navega linhas de tabela com ↑↓ e aciona com Enter */
export function useTableKeyNav<T>(
  items: T[],
  onEnter: (item: T, idx: number) => void
) {
  const [sel, setSel] = useState(-1)

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!items.length) return
    if (e.key === "ArrowDown")  { e.preventDefault(); setSel(i => Math.min(i + 1, items.length - 1)) }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setSel(i => Math.max(i - 1, 0)) }
    else if (e.key === "Enter" && sel >= 0) { e.preventDefault(); onEnter(items[sel], sel) }
    else if (e.key === "Escape")    { setSel(-1) }
  }, [items, sel, onEnter])

  const reset = () => setSel(-1)
  return { sel, setSel, onKeyDown, reset }
}

/** Navega lista de sugestões de autocomplete com ↑↓ e seleciona com Enter */
export function useDropdownKeyNav<T>(
  items: T[],
  onSelect: (item: T) => void,
  onClose?: () => void
) {
  const [hi, setHi] = useState(-1)

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown")  { e.preventDefault(); setHi(i => Math.min(i + 1, items.length - 1)) }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setHi(i => Math.max(i - 1, 0)) }
    else if (e.key === "Enter" && hi >= 0) { e.preventDefault(); onSelect(items[hi]); setHi(-1) }
    else if (e.key === "Escape")    { setHi(-1); onClose?.() }
  }, [items, hi, onSelect, onClose])

  const reset = () => setHi(-1)
  return { hi, onKeyDown, reset }
}
