-- ══════════════════════════════════════════════════════════
-- 005 — Live Flow V2: status, volumes, vínculo de produtos
-- ══════════════════════════════════════════════════════════

-- 1. Colunas novas em live_compras
ALTER TABLE live_compras
  ADD COLUMN IF NOT EXISTS status_compra     TEXT DEFAULT 'cadastrada',
  ADD COLUMN IF NOT EXISTS quantidade_volumes INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS observacao        TEXT;

-- 2. Tabela de produtos vinculados a cada compra
CREATE TABLE IF NOT EXISTS live_compra_produtos (
  id               BIGSERIAL PRIMARY KEY,
  compra_id        BIGINT REFERENCES live_compras(id) ON DELETE CASCADE,
  produto_id       BIGINT REFERENCES produtos(id) ON DELETE SET NULL,
  nome_produto     TEXT NOT NULL,
  quantidade       INTEGER NOT NULL DEFAULT 1,
  preco_original   NUMERIC(12,2) DEFAULT 0,
  preco_live       NUMERIC(12,2) DEFAULT 0,
  desconto_aplicado NUMERIC(12,2) GENERATED ALWAYS AS (preco_original - preco_live) STORED,
  estoque_baixado  BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Atualiza view v_live_compras para incluir novos campos
DROP VIEW IF EXISTS v_live_compras;
CREATE OR REPLACE VIEW v_live_compras AS
SELECT
  lc.*,
  l.data_live,
  l.titulo   AS tipo_live,
  l.plataforma,
  COALESCE(lcp.total_produtos, 0)      AS total_produtos_vinculados,
  COALESCE(lcp.total_baixados, 0)      AS total_estoque_baixado
FROM live_compras lc
LEFT JOIN lives l ON l.id = lc.live_id
LEFT JOIN (
  SELECT
    compra_id,
    SUM(quantidade)                   AS total_produtos,
    SUM(CASE WHEN estoque_baixado THEN quantidade ELSE 0 END) AS total_baixados
  FROM live_compra_produtos
  GROUP BY compra_id
) lcp ON lcp.compra_id = lc.id;
