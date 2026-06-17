-- ══════════════════════════════════════════════════════════════
-- 030 — Corrige fn_credito_saida (garante que SUBTRAI o saldo)
-- Executar manualmente no Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

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

  -- SAÍDA: subtrai o valor do saldo
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

-- Verificar se a função está correta após aplicar:
SELECT proname, prosrc
  FROM pg_proc
  WHERE proname = 'fn_credito_saida'
  LIMIT 1;
