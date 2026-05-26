-- ══════════════════════════════════════════════════════════════════
-- Tabela: etiquetas
-- Armazena referências de etiquetas geradas no Melhor Envio
-- Execute este script no SQL Editor do Supabase
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.etiquetas (
  id            BIGSERIAL PRIMARY KEY,
  me_order_id   TEXT        NOT NULL,          -- ID do pedido no Melhor Envio
  me_protocol   TEXT,                          -- Protocolo ME
  me_tracking   TEXT,                          -- Código de rastreio
  venda_id      BIGINT REFERENCES vendas(id) ON DELETE SET NULL,
  service_id    INT         NOT NULL,          -- ID do serviço/transportadora
  status        TEXT        NOT NULL DEFAULT 'pending',
  cep_destino   TEXT,
  label_url     TEXT,                          -- URL do PDF da etiqueta
  criado_por    BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_etiquetas_venda_id    ON public.etiquetas(venda_id);
CREATE INDEX IF NOT EXISTS idx_etiquetas_me_order_id ON public.etiquetas(me_order_id);
CREATE INDEX IF NOT EXISTS idx_etiquetas_status      ON public.etiquetas(status);

-- RLS
ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler etiquetas"
  ON public.etiquetas FOR SELECT
  USING (true);

CREATE POLICY "Autenticados podem inserir etiquetas"
  ON public.etiquetas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Autenticados podem atualizar etiquetas"
  ON public.etiquetas FOR UPDATE
  USING (true);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_etiquetas_updated_at ON public.etiquetas;
CREATE TRIGGER trg_etiquetas_updated_at
  BEFORE UPDATE ON public.etiquetas
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
