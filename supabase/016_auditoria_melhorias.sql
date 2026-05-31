-- ══════════════════════════════════════════════════════════════════
-- 016 — MELHORIAS DA AUDITORIA (maio/2026)
-- Cria tabelas e colunas para: log de WhatsApp, flags de
-- consentimento LGPD, alertas financeiros, link de live,
-- e histórico de envios vinculado a clientes.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Log centralizado de disparos WhatsApp ─────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_log (
  id           BIGSERIAL PRIMARY KEY,
  telefone     TEXT        NOT NULL,
  tipo         TEXT        NOT NULL DEFAULT 'outro',
  mensagem     TEXT,
  status       TEXT        NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','erro')),
  erro         TEXT,
  message_id   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.whatsapp_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso whatsapp_log" ON public.whatsapp_log USING (true) WITH CHECK (true);

-- ── 2. Flags de consentimento LGPD nos clientes ─────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='aceita_novidades') THEN
    ALTER TABLE public.clientes ADD COLUMN aceita_novidades TEXT NOT NULL DEFAULT 'nao' CHECK (aceita_novidades IN ('nao','aguardando','confirmado','recusado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='aceita_lives') THEN
    ALTER TABLE public.clientes ADD COLUMN aceita_lives TEXT NOT NULL DEFAULT 'nao' CHECK (aceita_lives IN ('nao','aguardando','confirmado','recusado'));
  END IF;
END $$;

-- ── 3. Campo link_live na tabela lives ───────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lives' AND column_name='link_live') THEN
    ALTER TABLE public.lives ADD COLUMN link_live TEXT;
  END IF;
END $$;

-- ── 4. Tabela de configurações de alertas ────────────────────
CREATE TABLE IF NOT EXISTS public.config_alertas (
  id           SERIAL PRIMARY KEY,
  chave        TEXT        NOT NULL UNIQUE,
  valor        TEXT        NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.config_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso config_alertas" ON public.config_alertas USING (true) WITH CHECK (true);

-- Insere defaults
INSERT INTO public.config_alertas (chave, valor) VALUES
  ('alerta_numero_1', ''),
  ('alerta_numero_2', '')
ON CONFLICT (chave) DO NOTHING;

-- ── 5. Vincular etiquetas a clientes (para histórico de envios) ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='etiquetas' AND column_name='cliente_id') THEN
    ALTER TABLE public.etiquetas ADD COLUMN cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='etiquetas' AND column_name='ultimo_status') THEN
    ALTER TABLE public.etiquetas ADD COLUMN ultimo_status TEXT DEFAULT 'gerada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='etiquetas' AND column_name='notificado_envio') THEN
    ALTER TABLE public.etiquetas ADD COLUMN notificado_envio BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='etiquetas' AND column_name='notificado_transito') THEN
    ALTER TABLE public.etiquetas ADD COLUMN notificado_transito BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='etiquetas' AND column_name='notificado_entregue') THEN
    ALTER TABLE public.etiquetas ADD COLUMN notificado_entregue BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════
-- FIM — aplique no Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════
