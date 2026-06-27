-- Adiciona campo para registrar quando o cliente respondeu ao consentimento.
-- Usado pelo cron de follow-up para não reenviar mensagem a quem já respondeu,
-- mesmo que o webhook tenha falhado em atualizar o notificacao_status.

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS consentimento_respondido_em timestamptz DEFAULT NULL;

-- Índice para o cron filtrar rapidamente (IS NULL = não respondeu)
CREATE INDEX IF NOT EXISTS idx_clientes_consentimento_respondido
  ON clientes (consentimento_respondido_em)
  WHERE consentimento_respondido_em IS NULL;
