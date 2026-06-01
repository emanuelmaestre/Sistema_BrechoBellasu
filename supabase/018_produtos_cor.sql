-- ══════════════════════════════════════════════════════════════════
-- 018 — CAMPO COR NOS PRODUTOS (junho/2026)
-- Adiciona coluna cor na tabela produtos para registro da
-- cor principal de cada peça do brechó.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS cor TEXT;

-- ══════════════════════════════════════════════════════════════════
-- FIM — já aplicado em produção em 01/06/2026.
-- ══════════════════════════════════════════════════════════════════
