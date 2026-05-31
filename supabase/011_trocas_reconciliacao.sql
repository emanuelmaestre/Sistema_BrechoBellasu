-- ══════════════════════════════════════════════════════════════════
-- 011 — Reconciliação da tabela trocas
-- Execute UMA vez no Supabase SQL Editor. Idempotente.
--
-- POR QUE: o código (e o front) usam colunas que não existem no banco
-- real (cliente_nome, produto_id, nome_produto, quantidade,
-- responsavel_id, decisao_produto, resultado_fin, observacoes) — por isso
-- criar troca falhava (fallback 42703) e o CHECK de status conflitava com
-- o vocabulário do app (solicitado/aprovado/recusado).
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.trocas
  ADD COLUMN IF NOT EXISTS cliente_nome    TEXT,
  ADD COLUMN IF NOT EXISTS produto_id      BIGINT,
  ADD COLUMN IF NOT EXISTS nome_produto    TEXT,
  ADD COLUMN IF NOT EXISTS quantidade      INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS responsavel_id  BIGINT,
  ADD COLUMN IF NOT EXISTS decisao_produto TEXT,
  ADD COLUMN IF NOT EXISTS resultado_fin   TEXT,
  ADD COLUMN IF NOT EXISTS observacoes     TEXT;

-- Status passa a ser livre (workflow do app); remove o CHECK antigo.
ALTER TABLE public.trocas DROP CONSTRAINT IF EXISTS trocas_status_check;
ALTER TABLE public.trocas ALTER COLUMN status SET DEFAULT 'solicitado';
