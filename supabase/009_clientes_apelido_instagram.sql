-- ══════════════════════════════════════════════════════════════════
-- 009 — Colunas apelido/instagram em clientes
-- Execute UMA vez no Supabase SQL Editor. Idempotente.
--
-- POR QUE: o código sempre tentou gravar `apelido` e `instagram`, mas o
-- banco real não tinha essas colunas (migrations 003/004 não chegaram a
-- produção). As rotas usavam um fallback frágil que ENGOLIA esses campos
-- via erro 42703. Esta migration cria as colunas e o repositório passa a
-- gravá-las direto, sem fallback.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS apelido   TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT;
