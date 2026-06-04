-- ══════════════════════════════════════════════════════════════════
-- 025 — Categorias Brechó Bellasu (substituição completa)
-- 25 categorias em ordem alfabética, específicas do negócio.
-- Execute UMA vez no Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════

-- Remove categorias antigas (sem vínculo com produtos: SET NULL na FK)
DELETE FROM public.categorias;

-- Reseta a sequência do ID para começar do 1
ALTER SEQUENCE public.categorias_id_seq RESTART WITH 1;

-- Insere as 25 categorias em ordem alfabética
INSERT INTO public.categorias (nome) VALUES
  ('ACESSÓRIOS'),
  ('BERMUDAS'),
  ('BLAZERS'),
  ('BODY'),
  ('CALÇA JEANS'),
  ('CALÇAS ALFAIATARIA'),
  ('CALÇAS LEGGING'),
  ('CALÇAS PANTALONA'),
  ('CALÇADOS'),
  ('COLETES'),
  ('CONJUNTOS'),
  ('CROPPEDS'),
  ('JARDINEIRAS'),
  ('JAQUETAS'),
  ('KIMONOS'),
  ('LINGERIE'),
  ('MACACÕES'),
  ('MODA FITNESS'),
  ('MODA INVERNO'),
  ('MODA PRAIA'),
  ('SAIAS'),
  ('SHORTS'),
  ('T-SHIRT'),
  ('TOPS'),
  ('VESTIDOS');

-- ══════════════════════════════════════════════════════════════════
-- FIM — 25 categorias inseridas.
-- ══════════════════════════════════════════════════════════════════
