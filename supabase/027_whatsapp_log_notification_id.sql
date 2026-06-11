-- ══════════════════════════════════════════════════════════════════
-- 027 — IDEMPOTÊNCIA DE NOTIFICAÇÕES (junho/2026)
-- Adiciona notification_id em whatsapp_log para prevenir envios
-- duplicados de mensagens de compra da live.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.whatsapp_log
  ADD COLUMN IF NOT EXISTS notification_id TEXT;

CREATE INDEX IF NOT EXISTS idx_whatsapp_log_notification_id
  ON public.whatsapp_log (notification_id)
  WHERE notification_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════
-- FIM — executar no Supabase SQL Editor antes do deploy.
-- ══════════════════════════════════════════════════════════════════
