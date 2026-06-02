-- ══════════════════════════════════════════════════════════
-- 021 — Coluna notificacao_status na tabela vendas
-- Valores: 'pendente' | 'enviado' | 'erro' | NULL (legado)
-- ══════════════════════════════════════════════════════════

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS notificacao_status TEXT
    CHECK (notificacao_status IN ('pendente', 'enviado', 'erro'))
    DEFAULT NULL;

COMMENT ON COLUMN vendas.notificacao_status IS
  'Status do envio automático do recibo via WhatsApp: pendente | enviado | erro';
