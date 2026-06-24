-- ══════════════════════════════════════════════════════════════
-- 031 — Crédito aplicado em compras da Live
-- Executar manualmente no Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Coluna que registra quanto de crédito foi abatido nesta compra
ALTER TABLE public.live_compras
  ADD COLUMN IF NOT EXISTS credito_aplicado NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Índice para consultas de histórico de uso de crédito
CREATE INDEX IF NOT EXISTS idx_live_compras_credito
  ON public.live_compras(cliente_id)
  WHERE credito_aplicado > 0;
