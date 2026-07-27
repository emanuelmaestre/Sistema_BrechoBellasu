BEGIN;

-- A tabela e as funcoes sao acessadas somente pela API autenticada, usando a
-- service role. RLS e revogacoes impedem que a chave publica contorne a API.
ALTER TABLE public.penalidades_clientes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.penalidades_clientes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.penalidades_clientes_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.penalidades_clientes TO service_role;
GRANT ALL ON SEQUENCE public.penalidades_clientes_id_seq TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'penalidades_observacao_tamanho_check'
       AND conrelid = 'public.penalidades_clientes'::regclass
  ) THEN
    ALTER TABLE public.penalidades_clientes
      ADD CONSTRAINT penalidades_observacao_tamanho_check
      CHECK (observacao IS NULL OR char_length(observacao) <= 1000);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'penalidades_remocao_tamanho_check'
       AND conrelid = 'public.penalidades_clientes'::regclass
  ) THEN
    ALTER TABLE public.penalidades_clientes
      ADD CONSTRAINT penalidades_remocao_tamanho_check
      CHECK (motivo_remocao IS NULL OR char_length(motivo_remocao) <= 1000);
  END IF;
END
$$;

-- Evita duplo clique, repeticao de requisicao ou duas abas criarem a mesma
-- penalidade ativa para a mesma cliente e live.
CREATE UNIQUE INDEX IF NOT EXISTS uq_penalidade_ativa_cliente_live_motivo
  ON public.penalidades_clientes (cliente_id, live_id, motivo)
  WHERE status = 'ativa' AND live_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_penalidade_entrada(
  p_cliente_id BIGINT,
  p_live_id BIGINT DEFAULT NULL,
  p_motivo TEXT DEFAULT NULL,
  p_obs TEXT DEFAULT NULL,
  p_user_id BIGINT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_pen_id BIGINT;
BEGIN
  IF p_motivo NOT IN ('nao_pagou_prazo', 'desistiu_apos_contemplar') THEN
    RAISE EXCEPTION 'Motivo de penalidade invalido';
  END IF;
  IF p_obs IS NOT NULL AND char_length(p_obs) > 1000 THEN
    RAISE EXCEPTION 'Observacao excede o limite';
  END IF;

  SELECT total_penalidades_ativas
    INTO v_total
    FROM public.clientes
   WHERE id = p_cliente_id
     FOR UPDATE;

  IF v_total IS NULL THEN
    RAISE EXCEPTION 'Cliente nao encontrado';
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
END
$$;

-- A versao anterior aceitava somente o id da penalidade. A nova assinatura
-- exige tambem o cliente da URL, eliminando remocao cruzada entre clientes.
DROP FUNCTION IF EXISTS public.fn_penalidade_remover(BIGINT, TEXT, BIGINT);

CREATE FUNCTION public.fn_penalidade_remover(
  p_penalidade_id BIGINT,
  p_cliente_id BIGINT,
  p_motivo_remocao TEXT DEFAULT NULL,
  p_user_id BIGINT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF p_motivo_remocao IS NOT NULL
     AND char_length(p_motivo_remocao) > 1000 THEN
    RAISE EXCEPTION 'Motivo de remocao excede o limite';
  END IF;

  SELECT status
    INTO v_status
    FROM public.penalidades_clientes
   WHERE id = p_penalidade_id
     AND cliente_id = p_cliente_id
     FOR UPDATE;

  IF v_status IS NULL OR v_status <> 'ativa' THEN
    RAISE EXCEPTION 'Penalidade ativa nao encontrada para a cliente';
  END IF;

  UPDATE public.clientes
     SET total_penalidades_ativas =
       GREATEST(0, total_penalidades_ativas - 1)
   WHERE id = p_cliente_id;

  UPDATE public.penalidades_clientes
     SET status = 'removida',
         motivo_remocao = p_motivo_remocao,
         removido_por_id = p_user_id,
         removido_em = NOW()
   WHERE id = p_penalidade_id
     AND cliente_id = p_cliente_id;

  RETURN p_penalidade_id;
END
$$;

REVOKE ALL ON FUNCTION public.fn_penalidade_entrada(
  BIGINT, BIGINT, TEXT, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_penalidade_remover(
  BIGINT, BIGINT, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_penalidade_entrada(
  BIGINT, BIGINT, TEXT, TEXT, BIGINT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_penalidade_remover(
  BIGINT, BIGINT, TEXT, BIGINT
) TO service_role;

COMMIT;
