-- Migration 028: Google Contacts sync fields
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS google_contact_id      TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS google_sync_status     TEXT NOT NULL DEFAULT 'pendente' CHECK (google_sync_status IN ('pendente','sincronizando','sincronizado','erro'));
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS google_sync_at         TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS google_sync_tentativa  TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS google_sync_erro       TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS google_sync_tentativas INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_clientes_google_contact_id ON clientes(google_contact_id);

-- Log imutável de sincronizações (auditoria — sem DELETE/UPDATE)
CREATE TABLE IF NOT EXISTS public.google_contacts_log (
  id              BIGSERIAL PRIMARY KEY,
  cliente_id      BIGINT REFERENCES clientes(id),
  acao            TEXT NOT NULL CHECK (acao IN ('criar','atualizar','buscar','erro')),
  nome_montado    TEXT,
  telefone_norm   TEXT,
  google_contact_id TEXT,
  sucesso         BOOLEAN NOT NULL DEFAULT false,
  erro_msg        TEXT,
  criado_por_id   BIGINT REFERENCES usuarios(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_contacts_log_cliente ON google_contacts_log(cliente_id);

ALTER TABLE public.google_contacts_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso google_contacts_log" ON public.google_contacts_log USING (true) WITH CHECK (true);
