-- 039 - Remove residuos da integracao Asaas.
ALTER TABLE IF EXISTS public.live_compras
  DROP COLUMN IF EXISTS asaas_payment_id;
