-- ══════════════════════════════════════════════════════════════════
-- 014 — CLIENTES: previne duplicatas por celular/WhatsApp
-- Execute UMA vez no Supabase SQL Editor.
--
-- POR QUE: sem constraint, o mesmo celular podia ser cadastrado
-- várias vezes (ex: 5 registros "Emanuel Maestre dos Santos").
-- Agora o banco rejeita inserções com celular duplicado.
--
-- ANTES DE APLICAR: limpe duplicatas existentes no banco.
-- ══════════════════════════════════════════════════════════════════

-- Unique parcial: só aplica quando celular não é null
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_celular
  ON public.clientes (celular)
  WHERE celular IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════
-- FIM
-- ══════════════════════════════════════════════════════════════════
