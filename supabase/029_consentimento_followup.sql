-- 029 — Agente de consentimento com follow-up configuravel
-- Execute no Supabase SQL Editor antes do deploy.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS consentimento_enviado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consentimento_followup_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consentimento_followup_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_clientes_consentimento_followup
  ON public.clientes (notificacao_status, consentimento_enviado_em)
  WHERE notificacao_status = 'enviado';

INSERT INTO public.config_alertas (chave, valor) VALUES
  ('consentimento_followup_ativo', 'true'),
  ('consentimento_followup_horas', '24'),
  ('consentimento_followup_max', '1')
ON CONFLICT (chave) DO NOTHING;
