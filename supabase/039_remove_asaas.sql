-- 039 - Remove residuos da integracao Asaas.
ALTER TABLE IF EXISTS public.live_compras
  DROP COLUMN IF EXISTS asaas_payment_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'live_compras'
      AND column_name = 'asaas_payment_id'
  ) THEN
    RAISE EXCEPTION 'Falha ao remover public.live_compras.asaas_payment_id';
  END IF;
END
$$;
