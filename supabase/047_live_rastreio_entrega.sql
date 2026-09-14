-- ══════════════════════════════════════════════════════════════════
-- Rastreio de ENTREGA das mensagens de WhatsApp (auditoria 14/09/2026).
--
-- O disparo da live gravava msg_enviada_em / msg_texto / msg_zapi_id, mas
-- essas colunas nunca existiram: a gravação falhava em silêncio e não havia
-- como ligar a compra à mensagem nem saber se ela chegou no celular.
--
-- entrega_status segue o webhook de status da Z-API, sempre só avançando:
--   SENT → RECEIVED (entregue) → READ (lida) → PLAYED (áudio ouvido)
--
-- msg_travado_em é a trava do disparo: impede que duas abas/aparelhos
-- enviem a mesma compra ao mesmo tempo (mensagem duplicada).
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.live_compras
  ADD COLUMN IF NOT EXISTS msg_enviada_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS msg_texto           TEXT,
  ADD COLUMN IF NOT EXISTS msg_zapi_id         TEXT,
  ADD COLUMN IF NOT EXISTS msg_entrega_status  TEXT,
  ADD COLUMN IF NOT EXISTS msg_entregue_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS msg_lida_em         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS msg_travado_em      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_live_compras_msg_zapi_id
  ON public.live_compras (msg_zapi_id) WHERE msg_zapi_id IS NOT NULL;

ALTER TABLE public.whatsapp_log
  ADD COLUMN IF NOT EXISTS entrega_status  TEXT,
  ADD COLUMN IF NOT EXISTS entregue_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lida_em         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_whatsapp_log_message_id
  ON public.whatsapp_log (message_id) WHERE message_id IS NOT NULL;
