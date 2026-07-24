-- Bloqueia acesso direto das roles publicas. O sistema usa somente o backend
-- autenticado com service_role para acessar as tabelas do schema public.
DO $$
DECLARE
  tabela record;
  politica record;
BEGIN
  FOR tabela IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    FOR politica IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tabela.tablename
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        politica.policyname,
        tabela.tablename
      );
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tabela.tablename);
  END LOOP;
END
$$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

UPDATE public.etiquetas
SET carrier = 'melhorenvio'
WHERE carrier NOT IN ('melhorenvio', 'superfrete');

ALTER TABLE public.etiquetas
  DROP CONSTRAINT IF EXISTS etiquetas_carrier_check;
ALTER TABLE public.etiquetas
  ADD CONSTRAINT etiquetas_carrier_check
  CHECK (carrier IN ('melhorenvio', 'superfrete'));
