-- ══════════════════════════════════════════════════════════════════
-- Busca de endereços — Fase 1
--
-- 1. `enderecos_cache`: guarda o resultado já normalizado das buscas
--    externas (ViaCEP / BrasilAPI / Photon). A segunda vez que alguém
--    digitar a mesma rua, a resposta sai do banco em milissegundos e
--    nenhuma API externa é chamada.
--
-- 2. `buscar_enderecos_cadastrados()`: autocomplete a partir dos
--    endereços que JÁ existem no cadastro de clientes. Como as clientes
--    do brechó se repetem muito por bairro, essa é a fonte mais rápida
--    e mais confiável — e não depende de nenhum serviço de terceiro.
--
-- Execute este script no SQL Editor do Supabase. É idempotente.
-- ══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Normalização: minúsculas + remoção de acentos ────────────────
-- Feita com TRANSLATE para não depender da extensão `unaccent`
-- (que nem sempre está habilitada no projeto).
-- Precisa vir antes das funções que a utilizam.
CREATE OR REPLACE FUNCTION public.unaccent_simples(p_txt TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT LOWER(TRANSLATE(
    COALESCE(p_txt, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  ));
$$;

-- ── 1. Cache de buscas externas ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enderecos_cache (
  chave       TEXT PRIMARY KEY,                       -- termo de busca normalizado
  resultado   JSONB       NOT NULL,                   -- array de sugestões normalizadas
  hits        INT         NOT NULL DEFAULT 0,         -- quantas vezes foi reaproveitado
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enderecos_cache_updated
  ON public.enderecos_cache (updated_at DESC);

ALTER TABLE public.enderecos_cache ENABLE ROW LEVEL SECURITY;
-- Sem policies: acesso somente via service role (rotas server-side).

-- Incrementa o contador de reuso sem precisar de SELECT + UPDATE na app.
CREATE OR REPLACE FUNCTION public.registrar_hit_endereco_cache(p_chave TEXT)
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE public.enderecos_cache
     SET hits = hits + 1, updated_at = NOW()
   WHERE chave = p_chave;
$$;

-- ── 2. Autocomplete pelos endereços já cadastrados ───────────────
-- Índices trigram deixam o ILIKE '%termo%' rápido mesmo com curinga
-- no início (um B-tree comum não serve para esse caso).
CREATE INDEX IF NOT EXISTS idx_clientes_logradouro_trgm
  ON public.clientes USING GIN (logradouro gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_bairro_trgm
  ON public.clientes USING GIN (bairro gin_trgm_ops);

-- Recebe os tokens já normalizados pela aplicação e devolve endereços
-- distintos, ordenados pela quantidade de clientes que moram neles.
CREATE OR REPLACE FUNCTION public.buscar_enderecos_cadastrados(
  p_tokens TEXT[],
  p_limite INT DEFAULT 6
)
RETURNS TABLE (
  cep         TEXT,
  logradouro  TEXT,
  bairro      TEXT,
  cidade      TEXT,
  estado      TEXT,
  ocorrencias BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    MAX(c.cep)             AS cep,
    c.logradouro,
    COALESCE(c.bairro, '') AS bairro,
    COALESCE(c.cidade, '') AS cidade,
    COALESCE(c.estado, '') AS estado,
    COUNT(*)               AS ocorrencias
  FROM public.clientes c
  WHERE c.logradouro IS NOT NULL
    AND LENGTH(TRIM(c.logradouro)) > 2
    -- Todos os tokens precisam aparecer no endereço (em qualquer ordem).
    AND (
      SELECT bool_and(
        public.unaccent_simples(
          CONCAT_WS(' ', c.logradouro, c.bairro, c.cidade)
        ) LIKE '%' || tok || '%'
      )
      FROM unnest(p_tokens) AS tok
    )
  GROUP BY c.logradouro, COALESCE(c.bairro, ''), COALESCE(c.cidade, ''), COALESCE(c.estado, '')
  ORDER BY COUNT(*) DESC, c.logradouro ASC
  LIMIT p_limite;
$$;
