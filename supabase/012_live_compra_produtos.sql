-- ══════════════════════════════════════════════════════════════════
-- 012 — Vínculo de produtos da Live (live_compra_produtos + status)
-- Execute UMA vez no Supabase SQL Editor. Idempotente.
--
-- POR QUE: o fluxo de vincular produtos a uma compra da live e finalizá-la
-- depende da tabela live_compra_produtos e das colunas status_compra /
-- quantidade_volumes em live_compras — que nunca foram criadas (migration
-- 007 não aplicada). Sem isso, vincular produto e finalizar compra falham.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.live_compra_produtos (
  id              BIGSERIAL PRIMARY KEY,
  compra_id       BIGINT NOT NULL REFERENCES public.live_compras(id) ON DELETE CASCADE,
  produto_id      BIGINT REFERENCES public.produtos(id) ON DELETE SET NULL,
  nome_produto    TEXT NOT NULL,
  quantidade      INTEGER NOT NULL DEFAULT 1,
  preco_original  NUMERIC(12,2) NOT NULL DEFAULT 0,
  preco_live      NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_baixado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lcp_compra  ON public.live_compra_produtos(compra_id);
CREATE INDEX IF NOT EXISTS idx_lcp_produto ON public.live_compra_produtos(produto_id);

-- Segurança: backend usa service_role (ignora RLS); anon não acessa.
ALTER TABLE public.live_compra_produtos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_compra_produtos FROM anon;

ALTER TABLE public.live_compras
  ADD COLUMN IF NOT EXISTS status_compra      TEXT DEFAULT 'aguardando_vinculo',
  ADD COLUMN IF NOT EXISTS quantidade_volumes INTEGER DEFAULT 1;
