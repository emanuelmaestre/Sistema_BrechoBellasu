-- ══════════════════════════════════════════════════════════════
-- 036 — Sistema de Penalidades para Lives
-- Executar manualmente no Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Contador desnormalizado (evita JOIN na busca da live)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS total_penalidades_ativas INT NOT NULL DEFAULT 0;

-- 2. Tabela ledger imutável de penalidades
CREATE TABLE IF NOT EXISTS public.penalidades_clientes (
  id              BIGSERIAL PRIMARY KEY,
  cliente_id      BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  live_id         BIGINT REFERENCES public.lives(id) ON DELETE SET NULL,
  motivo          TEXT NOT NULL CHECK (motivo IN ('nao_pagou_prazo','desistiu_apos_contemplar')),
  observacao      TEXT,
  status          TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','removida')),
  motivo_remocao  TEXT,
  criado_por_id   BIGINT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  removido_por_id BIGINT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removido_em     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_penalidades_cliente_id ON public.penalidades_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_penalidades_status      ON public.penalidades_clientes(status);
CREATE INDEX IF NOT EXISTS idx_penalidades_created_at  ON public.penalidades_clientes(created_at DESC);

-- 3. Função de ENTRADA de penalidade (atômica com FOR UPDATE)
CREATE OR REPLACE FUNCTION public.fn_penalidade_entrada(
  p_cliente_id  BIGINT,
  p_live_id     BIGINT DEFAULT NULL,
  p_motivo      TEXT DEFAULT NULL,
  p_obs         TEXT DEFAULT NULL,
  p_user_id     BIGINT DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_total  INT;
  v_pen_id BIGINT;
BEGIN
  SELECT total_penalidades_ativas INTO v_total
    FROM public.clientes WHERE id = p_cliente_id FOR UPDATE;

  IF v_total IS NULL THEN
    RAISE EXCEPTION 'Cliente % não encontrado', p_cliente_id;
  END IF;

  UPDATE public.clientes
    SET total_penalidades_ativas = total_penalidades_ativas + 1
    WHERE id = p_cliente_id;

  INSERT INTO public.penalidades_clientes
    (cliente_id, live_id, motivo, observacao, criado_por_id)
  VALUES
    (p_cliente_id, p_live_id, p_motivo, p_obs, p_user_id)
  RETURNING id INTO v_pen_id;

  RETURN v_pen_id;
END $$;

-- 4. Função de REMOÇÃO de penalidade (decrementa contador, nunca abaixo de 0)
CREATE OR REPLACE FUNCTION public.fn_penalidade_remover(
  p_penalidade_id BIGINT,
  p_motivo_remocao TEXT DEFAULT NULL,
  p_user_id        BIGINT DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_cliente_id BIGINT;
  v_status     TEXT;
BEGIN
  SELECT cliente_id, status INTO v_cliente_id, v_status
    FROM public.penalidades_clientes WHERE id = p_penalidade_id FOR UPDATE;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Penalidade % não encontrada', p_penalidade_id;
  END IF;

  IF v_status = 'removida' THEN
    RAISE EXCEPTION 'Penalidade já foi removida';
  END IF;

  -- Lock e decrementa contador (mínimo 0)
  UPDATE public.clientes
    SET total_penalidades_ativas = GREATEST(0, total_penalidades_ativas - 1)
    WHERE id = v_cliente_id;

  UPDATE public.penalidades_clientes
    SET status          = 'removida',
        motivo_remocao  = p_motivo_remocao,
        removido_por_id = p_user_id,
        removido_em     = NOW()
    WHERE id = p_penalidade_id;

  RETURN p_penalidade_id;
END $$;
