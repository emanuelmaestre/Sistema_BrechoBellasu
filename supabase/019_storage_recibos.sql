-- ══════════════════════════════════════════════════════════
-- 019 — Bucket temporário para recibos PDF
-- Arquivos ficam apenas ~10s antes de serem deletados
-- ══════════════════════════════════════════════════════════

-- Cria o bucket (privado — acesso via signed URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recibos',
  'recibos',
  false,
  5242880,  -- 5MB por arquivo
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: service role pode fazer tudo (upload, download, delete)
CREATE POLICY "service_role_recibos_all"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'recibos')
WITH CHECK (bucket_id = 'recibos');
