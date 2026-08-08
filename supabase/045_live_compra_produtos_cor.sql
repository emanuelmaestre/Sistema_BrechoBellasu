-- ══════════════════════════════════════════════════════════════════
-- 045 — COR NA LINHA DO VÍNCULO DA LIVE (agosto/2026)
--
-- POR QUE: peças vendidas sob o produto genérico (código 0, sem controle
-- de estoque) herdavam nome e cor do registro compartilhado, então todas
-- as clientes recebiam a mesma descrição e não dava para diferenciar as
-- peças na conferência.
--
-- O nome já era próprio da linha (nome_produto); faltava a cor. Esta
-- coluna é um OVERRIDE DA LINHA: na leitura vale linha.cor ?? produtos.cor,
-- e gravar aqui nunca altera o catálogo — o produto genérico é
-- compartilhado entre clientes e editá-lo estragaria as demais.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.live_compra_produtos ADD COLUMN IF NOT EXISTS cor TEXT;
