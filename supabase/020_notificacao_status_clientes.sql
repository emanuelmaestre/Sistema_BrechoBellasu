-- ══════════════════════════════════════════════════════════
-- 020 — Coluna notificacao_status na tabela clientes
-- Valores: 'pendente' | 'enviado' | 'erro' | NULL (legado)
-- ══════════════════════════════════════════════════════════

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS notificacao_status TEXT
    CHECK (notificacao_status IN ('pendente', 'enviado', 'erro'))
    DEFAULT NULL;

COMMENT ON COLUMN clientes.notificacao_status IS
  'Status do envio da mensagem de consentimento LGPD: pendente | enviado | erro';
