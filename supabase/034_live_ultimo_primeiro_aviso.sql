-- ══════════════════════════════════════════════════════════════════
-- Guarda quem foi a PRIMEIRA cliente do último disparo de aviso de cada
-- live. O disparo embaralha a fila a cada envio; esta coluna serve para
-- garantir que o reenvio (live caiu) nunca comece pela mesma cliente do
-- disparo anterior. Nullable — enquanto vazia, a garantia só não trava.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS ultimo_aviso_primeiro_cliente_id BIGINT;
