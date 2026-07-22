CREATE TABLE IF NOT EXISTS live_avisos_log (
  id          BIGSERIAL PRIMARY KEY,
  live_id     INTEGER NOT NULL REFERENCES lives(id) ON DELETE CASCADE,
  cliente_id  INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  link        TEXT NOT NULL,
  enviado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_avisos_log_unique UNIQUE (live_id, cliente_id, link)
);
CREATE INDEX IF NOT EXISTS idx_live_avisos_log_live_link ON live_avisos_log (live_id, link);
