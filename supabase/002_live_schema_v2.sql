-- ─── Migração: adapta tabela lives ao schema v2 ───────────

-- 1. Adicionar colunas que a API espera (se não existirem)
ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS data_live    DATE,
  ADD COLUMN IF NOT EXISTS plataforma   TEXT,
  ADD COLUMN IF NOT EXISTS observacoes  TEXT;

-- 2. Preencher data_live com data_inicio quando disponível
UPDATE public.lives SET data_live = data_inicio::DATE WHERE data_live IS NULL AND data_inicio IS NOT NULL;

-- 3. Remover a constraint antiga de status e adicionar nova
ALTER TABLE public.lives DROP CONSTRAINT IF EXISTS lives_status_check;
ALTER TABLE public.lives
  ADD CONSTRAINT lives_status_check
  CHECK (status IN ('aberta','encerrada','disparada','agendada','ao_vivo'));

-- 4. Ajustar default do status para 'aberta'
ALTER TABLE public.lives ALTER COLUMN status SET DEFAULT 'aberta';

-- ─── Migração: adapta live_compras ao schema v2 ────────────

ALTER TABLE public.live_compras
  ADD COLUMN IF NOT EXISTS nome_cliente    TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp        TEXT,
  ADD COLUMN IF NOT EXISTS data_compra     DATE,
  ADD COLUMN IF NOT EXISTS cor_sacola      TEXT,
  ADD COLUMN IF NOT EXISTS numero_sacola   TEXT,
  ADD COLUMN IF NOT EXISTS quantidade_itens INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS valor_total     NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto        NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes     TEXT,
  ADD COLUMN IF NOT EXISTS msg_status      TEXT DEFAULT 'pendente';

-- ─── View v_live_compras (usada pela API GET /live/[id]) ───

CREATE OR REPLACE VIEW public.v_live_compras AS
SELECT
  c.id,
  c.live_id,
  c.cliente_id,
  COALESCE(c.nome_cliente, cl.nome, 'Desconhecido') AS nome_cliente,
  COALESCE(c.whatsapp, cl.celular)                  AS whatsapp,
  c.data_compra,
  c.cor_sacola,
  c.numero_sacola,
  c.quantidade_itens,
  c.valor_total,
  c.desconto,
  c.msg_status,
  c.observacoes,
  c.status,
  c.created_at
FROM public.live_compras c
LEFT JOIN public.clientes cl ON cl.id = c.cliente_id;

-- ─── live_compra_itens: garantir colunas ───────────────────

ALTER TABLE public.live_compra_itens
  ADD COLUMN IF NOT EXISTS produto_id     BIGINT REFERENCES produtos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nome_produto   TEXT,
  ADD COLUMN IF NOT EXISTS quantidade     INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_item  NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eh_live        BOOLEAN DEFAULT TRUE;
