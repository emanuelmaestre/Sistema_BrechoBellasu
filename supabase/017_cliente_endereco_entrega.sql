-- ══════════════════════════════════════════════════════════════════
-- 017 — ENDEREÇO DE ENTREGA ALTERNATIVO (maio/2026)
-- Permite que a cliente tenha um endereço de entrega diferente do
-- endereço de cadastro. Usado no fluxo de geração de etiquetas (2B):
-- se o endereço de entrega existir e divergir do cadastro, o sistema
-- pergunta qual usar — sem alterar o cadastro permanente.
-- ══════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='entrega_cep') THEN
    ALTER TABLE public.clientes
      ADD COLUMN entrega_cep         TEXT,
      ADD COLUMN entrega_logradouro  TEXT,
      ADD COLUMN entrega_numero      TEXT,
      ADD COLUMN entrega_complemento TEXT,
      ADD COLUMN entrega_bairro      TEXT,
      ADD COLUMN entrega_cidade      TEXT,
      ADD COLUMN entrega_estado      TEXT;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════
-- FIM — aplique no Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════
