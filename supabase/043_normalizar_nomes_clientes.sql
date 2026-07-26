-- Torna reproduzivel em novos ambientes a normalizacao executada no banco em
-- 26/07/2026. upper() preserva letras acentuadas conforme o locale do banco.
UPDATE public.clientes
SET nome = upper(trim(nome))
WHERE nome IS NOT NULL
  AND nome IS DISTINCT FROM upper(trim(nome));
