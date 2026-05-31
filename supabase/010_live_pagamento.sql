-- ══════════════════════════════════════════════════════════════════
-- 010 — Colunas de pagamento em live_compras (repara rastreamento Asaas)
-- Execute UMA vez no Supabase SQL Editor. Idempotente.
--
-- POR QUE: a migration 007 não chegou a produção. Sem estas colunas, o
-- link de pagamento gerado no Asaas NÃO era salvo (caía em fallback) e a
-- rota de sincronização de pagamentos quebrava (SELECT de coluna
-- inexistente). Com as colunas, o fluxo de cobrança da live volta a
-- funcionar e o código novo grava/lê direto, sem fallback.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.live_compras
  ADD COLUMN IF NOT EXISTS link_pagamento   TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS pagamento_status TEXT DEFAULT 'EM_ABERTO';

-- Índice para a sincronização (busca pendentes com pagamento)
CREATE INDEX IF NOT EXISTS idx_live_compras_pgto
  ON public.live_compras(live_id, pagamento_status);
