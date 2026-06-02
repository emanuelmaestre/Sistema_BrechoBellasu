-- ══════════════════════════════════════════════════════════
-- 022 — Coluna notificacao_status na tabela trocas
-- Valores: 'pendente' | 'enviado' | 'erro' | NULL (legado)
-- ══════════════════════════════════════════════════════════

ALTER TABLE trocas
  ADD COLUMN IF NOT EXISTS notificacao_status TEXT
    CHECK (notificacao_status IN ('pendente', 'enviado', 'erro'))
    DEFAULT NULL;

COMMENT ON COLUMN trocas.notificacao_status IS
  'Status do envio automático do recibo via WhatsApp: pendente | enviado | erro';
