-- ══════════════════════════════════════════════════════════════════
-- 051 — COR DA PEÇA NOS ITENS DA VENDA (setembro/2026)
--
-- POR QUE: sem catálogo, a peça é cadastrada na hora (igual à live) com
-- nome e cor escolhida na paleta. A live guarda a cor em campo próprio
-- (live_compra_produtos.cor); a venda passa a fazer o mesmo, em vez de
-- misturar a cor no nome.
--
-- Só ADICIONA: coluna nova (nula para vendas antigas) e fn_criar_venda
-- passa a gravá-la. O restante da função é idêntico ao anterior.
-- Idempotente.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.venda_itens
  ADD COLUMN IF NOT EXISTS cor TEXT;

COMMENT ON COLUMN public.venda_itens.cor IS
  'Cor da peça escolhida na paleta (mesma da live). NULL em vendas antigas e peças sem cor.';

CREATE OR REPLACE FUNCTION public.fn_criar_venda(
  p_cliente_id bigint,
  p_vendedor_id bigint,
  p_forma_pagamento text,
  p_desconto numeric,
  p_obs text,
  p_itens jsonb
) RETURNS jsonb
LANGUAGE plpgsql
AS $function$
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

  FOR item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_pid := NULLIF(item->>'produto_id','')::BIGINT;
    v_qtd := (item->>'qtd')::INT;
    INSERT INTO public.venda_itens (venda_id, produto_id, nome, cor, preco_unit, qtd, subtotal)
    VALUES (v_id, v_pid, item->>'nome', NULLIF(BTRIM(item->>'cor'), ''),
            (item->>'preco_unit')::NUMERIC, v_qtd,
            (item->>'preco_unit')::NUMERIC * v_qtd);
    IF v_pid IS NOT NULL THEN
      UPDATE public.produtos
        SET estoque_atual = estoque_atual - v_qtd
        WHERE id = v_pid AND controlar_estoque = true;
    END IF;
  END LOOP;

  INSERT INTO public.contas_receber (descricao, valor, vencimento, recebido_em, status, cliente_id, venda_id)
  VALUES ('Venda #' || v_id, v_total, CURRENT_DATE, CURRENT_DATE, 'recebido', p_cliente_id, v_id);

  RETURN jsonb_build_object('id', v_id, 'total', v_total);
END;
$function$;
