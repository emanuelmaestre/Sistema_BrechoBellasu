-- ══════════════════════════════════════════════════════════════════
-- 013 — VENDAS → FINANCEIRO (integração automática)
-- Execute UMA vez no Supabase SQL Editor, APÓS a 008.
--
-- POR QUE: fn_criar_venda não inseria em contas_receber, então o
-- painel "Entradas do mês" ficava zerado mesmo com vendas feitas.
-- Agora toda venda concluída gera automaticamente um registro em
-- contas_receber com status 'recebido' e recebido_em = NOW().
-- fn_cancelar_venda também cancela o registro financeiro associado.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_criar_venda(
  p_cliente_id BIGINT, p_vendedor_id BIGINT, p_forma_pagamento TEXT,
  p_desconto NUMERIC, p_obs TEXT, p_itens JSONB
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_id       BIGINT;
  v_subtotal NUMERIC := 0;
  v_total    NUMERIC;
  item       JSONB;
  v_pid      BIGINT;
  v_qtd      INT;
  v_estoque  INT;
  v_controla BOOLEAN;
  v_nome     TEXT;
BEGIN
  -- 1ª passada: soma subtotal e valida estoque
  FOR item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_subtotal := v_subtotal + (item->>'preco_unit')::NUMERIC * (item->>'qtd')::INT;
    v_pid := NULLIF(item->>'produto_id','')::BIGINT;
    v_qtd := (item->>'qtd')::INT;
    IF v_pid IS NOT NULL THEN
      SELECT estoque_atual, controlar_estoque, nome
        INTO v_estoque, v_controla, v_nome
        FROM public.produtos WHERE id = v_pid FOR UPDATE;
      IF COALESCE(v_controla, false) AND COALESCE(v_estoque, 0) < v_qtd THEN
        RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE:%:%:%', v_nome, COALESCE(v_estoque,0), v_qtd
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END LOOP;

  v_total := GREATEST(0, v_subtotal - COALESCE(p_desconto, 0));

  INSERT INTO public.vendas (cliente_id, vendedor_id, forma_pagamento, subtotal, desconto, total, obs, status)
  VALUES (p_cliente_id, p_vendedor_id, COALESCE(p_forma_pagamento,'Dinheiro'),
          v_subtotal, COALESCE(p_desconto,0), v_total, p_obs, 'concluida')
  RETURNING id INTO v_id;

  -- 2ª passada: insere itens e baixa estoque
  FOR item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_pid := NULLIF(item->>'produto_id','')::BIGINT;
    v_qtd := (item->>'qtd')::INT;
    INSERT INTO public.venda_itens (venda_id, produto_id, nome, preco_unit, qtd, subtotal)
    VALUES (v_id, v_pid, item->>'nome', (item->>'preco_unit')::NUMERIC, v_qtd,
            (item->>'preco_unit')::NUMERIC * v_qtd);
    IF v_pid IS NOT NULL THEN
      UPDATE public.produtos
        SET estoque_atual = estoque_atual - v_qtd
        WHERE id = v_pid AND controlar_estoque = true;
    END IF;
  END LOOP;

  -- ✅ NOVO: registra entrada no financeiro automaticamente
  INSERT INTO public.contas_receber (descricao, valor, vencimento, recebido_em, status, cliente_id, venda_id)
  VALUES (
    'Venda #' || v_id,
    v_total,
    CURRENT_DATE,
    CURRENT_DATE,
    'recebido',
    p_cliente_id,
    v_id
  );

  RETURN jsonb_build_object('id', v_id, 'total', v_total);
END;
$$;

-- Cancelar venda: marca cancelada + estorna estoque + cancela registro financeiro
CREATE OR REPLACE FUNCTION fn_cancelar_venda(p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.vendas SET status = 'cancelada' WHERE id = p_id;
  UPDATE public.produtos p
    SET estoque_atual = p.estoque_atual + vi.qtd
    FROM public.venda_itens vi
    WHERE vi.venda_id = p_id
      AND vi.produto_id = p.id
      AND p.controlar_estoque = true;
  UPDATE public.contas_receber
    SET status = 'cancelado'
    WHERE venda_id = p_id;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- FIM — aplique no Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════
