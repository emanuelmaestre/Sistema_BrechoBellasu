-- ══════════════════════════════════════════════════════════════════
-- 049 — EXCLUSÃO DE LIVE SEM PERDER CRÉDITO NEM ESTOQUE (setembro/2026)
--
-- POR QUE: excluir UMA compra já estornava o crédito da cliente e
-- devolvia o estoque das peças. Excluir a LIVE INTEIRA não fazia nada
-- disso — apagava a linha de `lives` e deixava o ON DELETE CASCADE levar
-- as compras embora em silêncio.
--
-- O prejuízo é real e mensurável: apagar uma live de 30 compras chegava a
-- sumir com R$ 65 de crédito das clientes (debitado do saldo delas, sem
-- nenhuma compra para mostrar) e a deixar 115 peças marcadas como
-- vendidas para sempre.
--
-- A compensação vem para dentro do banco, numa transação só, pelo mesmo
-- motivo que `fn_criar_venda` já vive aqui: feita na aplicação, ela
-- roda em vários passos soltos e qualquer falha no meio deixa metade do
-- estorno aplicado.
--
-- Execute UMA vez no Supabase SQL Editor. Idempotente.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_excluir_live(p_live_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
-- INVOKER, como todas as outras funções do sistema: DEFINER faria a
-- função rodar como dona do banco, furando RLS e permissões de tabela.
-- Combinado com o EXECUTE que o Postgres dá a PUBLIC por padrão, uma
-- chamada anônima com a chave pública apagaria qualquer live.
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_compra        RECORD;
  v_item          RECORD;
  v_credito_total NUMERIC := 0;
  v_pecas         INT := 0;
  v_compras       INT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lives WHERE id = p_live_id) THEN
    RAISE EXCEPTION 'LIVE_NAO_ENCONTRADA:%', p_live_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ── Estorno do crédito aplicado em cada compra ──
  FOR v_compra IN
    SELECT id, cliente_id, COALESCE(credito_aplicado, 0) AS credito
      FROM public.live_compras
     WHERE live_id = p_live_id
     ORDER BY id
     FOR UPDATE
  LOOP
    v_compras := v_compras + 1;
    IF v_compra.credito > 0 AND v_compra.cliente_id IS NOT NULL THEN
      PERFORM fn_credito_entrada(
        v_compra.cliente_id,
        v_compra.credito,
        'ajuste',
        format('Estorno por exclusão da live #%s (compra #%s)', p_live_id, v_compra.id),
        v_compra.id,
        'venda',
        NULL
      );
      v_credito_total := v_credito_total + v_compra.credito;
    END IF;
  END LOOP;

  -- ── Devolução do estoque das peças efetivamente baixadas ──
  -- Relativo (estoque_atual + qtd), nunca "escreve o valor que li":
  -- duas exclusões simultâneas perderiam uma das devoluções.
  FOR v_item IN
    SELECT p.produto_id, SUM(p.quantidade)::INT AS qtd
      FROM public.live_compra_produtos p
      JOIN public.live_compras c ON c.id = p.compra_id
     WHERE c.live_id = p_live_id
       AND p.produto_id IS NOT NULL
       AND p.estoque_baixado IS TRUE
     GROUP BY p.produto_id
  LOOP
    UPDATE public.produtos
       SET estoque_atual = COALESCE(estoque_atual, 0) + v_item.qtd
     WHERE id = v_item.produto_id
       AND controlar_estoque IS TRUE;
    v_pecas := v_pecas + v_item.qtd;
  END LOOP;

  -- As compras e os vínculos saem pelo ON DELETE CASCADE.
  DELETE FROM public.lives WHERE id = p_live_id;

  RETURN jsonb_build_object(
    'compras_excluidas', v_compras,
    'credito_estornado', v_credito_total,
    'pecas_devolvidas',  v_pecas
  );
END;
$$;

-- Revogar só de `anon` não basta: ele herda o EXECUTE concedido a PUBLIC.
REVOKE ALL ON FUNCTION public.fn_excluir_live(BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_excluir_live(BIGINT) TO service_role;
