-- ══════════════════════════════════════════════════════════════
-- 026 — Sistema de Crédito para Clientes
-- Executar manualmente no Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Saldo desnormalizado no cliente (atualizado atomicamente pelas funções abaixo)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS saldo_credito NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 2. Campos de valor na tabela trocas (hoje só tem produto_id/nome, sem preço)
ALTER TABLE public.trocas
  ADD COLUMN IF NOT EXISTS valor_produto  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS credito_gerado NUMERIC(10,2);

-- 3. Ledger imutável de movimentações de crédito
CREATE TABLE IF NOT EXISTS public.creditos_clientes (
  id             BIGSERIAL PRIMARY KEY,
  cliente_id     BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  tipo           TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  origem         TEXT NOT NULL CHECK (origem IN ('devolucao','troca','venda','manual','ajuste')),
  valor          NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  saldo_antes    NUMERIC(10,2) NOT NULL,
  saldo_depois   NUMERIC(10,2) NOT NULL,
  obs            TEXT,
  operacao_id    BIGINT,
  operacao_tipo  TEXT CHECK (operacao_tipo IN ('venda','troca') OR operacao_tipo IS NULL),
  criado_por_id  BIGINT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creditos_cliente_id ON public.creditos_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_creditos_created_at ON public.creditos_clientes(created_at DESC);

-- 4. Função de ENTRADA de crédito (atômica com FOR UPDATE)
CREATE OR REPLACE FUNCTION public.fn_credito_entrada(
  p_cliente_id  BIGINT,
  p_valor       NUMERIC,
  p_origem      TEXT,
  p_obs         TEXT DEFAULT NULL,
  p_op_id       BIGINT DEFAULT NULL,
  p_op_tipo     TEXT DEFAULT NULL,
  p_user_id     BIGINT DEFAULT NULL
) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE
  v_antes  NUMERIC;
  v_depois NUMERIC;
BEGIN
  SELECT saldo_credito INTO v_antes
    FROM public.clientes WHERE id = p_cliente_id FOR UPDATE;

  IF v_antes IS NULL THEN
    RAISE EXCEPTION 'Cliente % não encontrado', p_cliente_id;
  END IF;

  v_depois := v_antes + p_valor;

  UPDATE public.clientes
    SET saldo_credito = v_depois
    WHERE id = p_cliente_id;

  INSERT INTO public.creditos_clientes
    (cliente_id, tipo, origem, valor, saldo_antes, saldo_depois, obs, operacao_id, operacao_tipo, criado_por_id)
  VALUES
    (p_cliente_id, 'entrada', p_origem, p_valor, v_antes, v_depois, p_obs, p_op_id, p_op_tipo, p_user_id);

  RETURN v_depois;
END $$;

-- 5. Função de SAÍDA de crédito (valida saldo, nunca negativo)
CREATE OR REPLACE FUNCTION public.fn_credito_saida(
  p_cliente_id  BIGINT,
  p_valor       NUMERIC,
  p_origem      TEXT,
  p_obs         TEXT DEFAULT NULL,
  p_op_id       BIGINT DEFAULT NULL,
  p_op_tipo     TEXT DEFAULT NULL,
  p_user_id     BIGINT DEFAULT NULL
) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE
  v_antes  NUMERIC;
  v_depois NUMERIC;
BEGIN
  SELECT saldo_credito INTO v_antes
    FROM public.clientes WHERE id = p_cliente_id FOR UPDATE;

  IF v_antes IS NULL THEN
    RAISE EXCEPTION 'Cliente % não encontrado', p_cliente_id;
  END IF;

  IF v_antes < p_valor THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %, Solicitado: R$ %',
      v_antes::TEXT, p_valor::TEXT;
  END IF;

  v_depois := v_antes - p_valor;

  UPDATE public.clientes
    SET saldo_credito = v_depois
    WHERE id = p_cliente_id;

  INSERT INTO public.creditos_clientes
    (cliente_id, tipo, origem, valor, saldo_antes, saldo_depois, obs, operacao_id, operacao_tipo, criado_por_id)
  VALUES
    (p_cliente_id, 'saida', p_origem, p_valor, v_antes, v_depois, p_obs, p_op_id, p_op_tipo, p_user_id);

  RETURN v_depois;
END $$;
