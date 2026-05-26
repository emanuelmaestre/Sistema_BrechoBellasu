-- Adiciona campo tipo na tabela lives
-- Valores: 'novidades' (sem juros no cartão) | 'promocional' (cliente paga juros)

ALTER TABLE lives
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'novidades'
    CHECK (tipo IN ('novidades', 'promocional'));
