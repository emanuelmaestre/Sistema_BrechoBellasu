-- ══════════════════════════════════════════════════════════════════
-- 048 — ETIQUETA DA SACOLA (setembro/2026)
--
-- POR QUE: as sacolas da live passam a receber uma etiqueta térmica
-- 100 × 147 mm impressa em lote depois do disparo. Sem registrar o que
-- já saiu no papel, reabrir a tela no dia seguinte reimprime tudo e a
-- loja monta sacola duplicada.
--
-- etiqueta_impressa_em só é gravado depois que a pessoa CONFIRMA que o
-- papel saiu — clicar em imprimir não basta, porque a impressora pode
-- estar desconectada e o lote inteiro sumiria da lista sem ter saído.
--
-- Execute UMA vez no Supabase SQL Editor. Idempotente.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.live_compras
  ADD COLUMN IF NOT EXISTS etiqueta_impressa_em TIMESTAMPTZ;

-- A tela lista sempre por live e separa impressas de pendentes.
CREATE INDEX IF NOT EXISTS idx_live_compras_etiqueta
  ON public.live_compras(live_id, etiqueta_impressa_em);

COMMENT ON COLUMN public.live_compras.etiqueta_impressa_em IS
  'Quando a etiqueta da sacola foi confirmada como impressa. NULL = ainda pendente.';
