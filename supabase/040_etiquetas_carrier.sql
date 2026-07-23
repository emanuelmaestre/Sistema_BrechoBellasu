-- ══════════════════════════════════════════════════════════════════
-- Adiciona coluna carrier à tabela etiquetas
-- Permite identificar qual transportadora gerou cada etiqueta
-- (melhorenvio | superfrete) para rastreio e ações posteriores
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.etiquetas
  ADD COLUMN IF NOT EXISTS carrier TEXT NOT NULL DEFAULT 'melhorenvio';

-- Índice para filtrar por transportadora
CREATE INDEX IF NOT EXISTS idx_etiquetas_carrier ON public.etiquetas(carrier);
