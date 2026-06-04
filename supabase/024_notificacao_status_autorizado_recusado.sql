-- ══════════════════════════════════════════════════════════════════
-- 024 — Expande notificacao_status para incluir autorizado/recusado
--
-- Antes: 'pendente' | 'enviado' | 'erro'
-- Depois: 'pendente' | 'enviado' | 'autorizado' | 'recusado' | 'erro'
--
-- Por quê: o webhook de resposta do WhatsApp agora atualiza o status
-- diretamente para 'autorizado' ou 'recusado' quando o cliente
-- responde SIM ou NÃO, eliminando a necessidade de ler aceita_novidades
-- e aceita_lives separadamente na UI.
-- ══════════════════════════════════════════════════════════════════

-- Remove constraint antiga e recria com os novos valores
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_notificacao_status_check;

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_notificacao_status_check
  CHECK (notificacao_status IN ('pendente', 'enviado', 'autorizado', 'recusado', 'erro'));

-- ══════════════════════════════════════════════════════════════════
-- FIM — aplique UMA vez no Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════
