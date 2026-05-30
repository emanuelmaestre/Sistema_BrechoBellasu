-- ══════════════════════════════════════════════════════════════════
-- 007 — CORREÇÕES CRÍTICAS (segurança + schema)
-- Execute UMA vez no Supabase SQL Editor.
-- Idempotente: pode rodar novamente sem efeitos colaterais.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Coluna `tipo` na tabela lives (novidades | promocional) ──────
ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'novidades'
    CHECK (tipo IN ('novidades', 'promocional'));

-- ── 2. Colunas de pagamento/mensagem em live_compras ────────────────
ALTER TABLE public.live_compras
  ADD COLUMN IF NOT EXISTS asaas_payment_id  TEXT,
  ADD COLUMN IF NOT EXISTS pagamento_status  TEXT DEFAULT 'EM_ABERTO',
  ADD COLUMN IF NOT EXISTS msg_zapi_id       TEXT,
  ADD COLUMN IF NOT EXISTS msg_texto         TEXT,
  ADD COLUMN IF NOT EXISTS msg_enviada_em    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS link_pagamento    TEXT;

-- ── 3. Tabela whatsapp_mensagens (histórico de mensagens) ───────────
CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id            BIGSERIAL PRIMARY KEY,
  telefone      TEXT,
  nome_contato  TEXT,
  mensagem      TEXT,
  direcao       TEXT,          -- recebida | enviada
  evento        TEXT,          -- ao_receber | ao_enviar | status
  payload       JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_telefone ON public.whatsapp_mensagens(telefone);

-- ── 4. Tabela live_compra_produtos (vínculo produto ↔ compra) ───────
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
CREATE INDEX IF NOT EXISTS idx_lcp_compra ON public.live_compra_produtos(compra_id);
CREATE INDEX IF NOT EXISTS idx_lcp_produto ON public.live_compra_produtos(produto_id);

-- Garante colunas caso a tabela já existisse com schema antigo
ALTER TABLE public.live_compra_produtos
  ADD COLUMN IF NOT EXISTS preco_original  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preco_live      NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_baixado BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 5. Tabela marcas (autocomplete público) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.marcas (
  id         BIGSERIAL PRIMARY KEY,
  nome       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════
-- 6. SEGURANÇA — Bloqueia acesso da chave ANON a todas as tabelas
--    sensíveis. O backend usa a SERVICE_ROLE (ignora RLS) e continua
--    funcionando. A chave anon (exposta no browser) deixa de poder
--    ler/escrever dados diretamente via Supabase REST.
-- ══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  t  text;
  pol record;
  tabelas text[] := ARRAY[
    'usuarios','clientes','categorias','produtos','vendas','venda_itens',
    'contas_pagar','contas_receber','trocas','lives','live_compras',
    'live_compra_itens','live_compra_produtos','etiquetas','configuracoes',
    'whatsapp_mensagens'
  ];
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename = ANY(tabelas)
  LOOP
    -- Remove todas as políticas permissivas existentes
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    -- Mantém RLS habilitado → sem política, a anon é negada por padrão.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- Revoga grants diretos da role anon
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- ── 7. marcas: leitura pública liberada (autocomplete do frontend) ──
ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marcas_anon_select ON public.marcas;
CREATE POLICY marcas_anon_select ON public.marcas
  FOR SELECT TO anon USING (true);
GRANT SELECT ON public.marcas TO anon;

-- ══════════════════════════════════════════════════════════════════
-- FIM — todas as correções aplicadas.
-- ══════════════════════════════════════════════════════════════════
