-- ══════════════════════════════════════════════════════════════════
-- Histórico de etiquetas por cliente
-- Adiciona colunas de snapshot à tabela `etiquetas` para preservar os
-- dados usados no momento da emissão (mesmo que o cadastro mude depois)
-- e permitir um histórico consultável no cadastro do cliente.
--
-- Execute este script no SQL Editor do Supabase. É idempotente.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.etiquetas
  ADD COLUMN IF NOT EXISTS nome_cliente_snapshot    TEXT,
  ADD COLUMN IF NOT EXISTS endereco_snapshot        JSONB,
  ADD COLUMN IF NOT EXISTS tipo_etiqueta            TEXT,
  ADD COLUMN IF NOT EXISTS quantidade_reimpressoes  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_ultima_reimpressao  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dados_json               JSONB;

-- cliente_id já existe na tabela; garante o índice para consulta por cliente
CREATE INDEX IF NOT EXISTS idx_etiquetas_cliente_id ON public.etiquetas(cliente_id);
