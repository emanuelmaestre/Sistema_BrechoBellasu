-- ══════════════════════════════════════════════════════════════════
-- Remove a coluna condicao (novo/usado/seminovo) de produtos.
-- Campo nunca foi exposto no formulário/API do sistema — órfão desde
-- a migração inicial. Removido a pedido do usuário.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.produtos DROP COLUMN IF EXISTS condicao;
