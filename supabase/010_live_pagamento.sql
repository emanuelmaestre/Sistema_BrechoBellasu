-- 010 - Colunas genericas de pagamento em live_compras.
ALTER TABLE public.live_compras
  ADD COLUMN IF NOT EXISTS link_pagamento   TEXT,
  ADD COLUMN IF NOT EXISTS pagamento_status TEXT DEFAULT 'EM_ABERTO';

CREATE INDEX IF NOT EXISTS idx_live_compras_pgto
  ON public.live_compras(live_id, pagamento_status);
