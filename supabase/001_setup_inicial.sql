-- ══════════════════════════════════════════════════════════════════
-- Brechó Bellasu V2 — Setup Inicial do Banco de Dados
-- Execute no SQL Editor do Supabase (supabase.com → SQL Editor)
-- ══════════════════════════════════════════════════════════════════

-- ── Extensões ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Função updated_at automático ─────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- USUÁRIOS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.usuarios (
  id         BIGSERIAL PRIMARY KEY,
  nome       TEXT        NOT NULL,
  email      TEXT        NOT NULL UNIQUE,
  senha      TEXT        NOT NULL,  -- bcrypt hash
  perfil     TEXT        NOT NULL DEFAULT 'operador' CHECK (perfil IN ('admin','operador','vendedor')),
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access usuarios" ON public.usuarios USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Usuário admin padrão (senha: 123)
INSERT INTO public.usuarios (nome, email, senha, perfil, ativo)
VALUES ('Admin', 'admin@brechobellasu.com.br', '$2b$10$WRy4.LWO.sEgZ.c0XgDGuu7HmSzYKw5SyfB.YU4mEFLhDdV1n0LCm', 'admin', true)
ON CONFLICT (email) DO UPDATE SET senha = EXCLUDED.senha, perfil = EXCLUDED.perfil, ativo = true;

-- ══════════════════════════════════════════════════════════════════
-- CLIENTES
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.clientes (
  id          BIGSERIAL PRIMARY KEY,
  nome        TEXT        NOT NULL,
  email       TEXT,
  cpf_cnpj    TEXT,
  celular     TEXT,
  data_nasc   DATE,
  cep         TEXT,
  logradouro  TEXT,
  numero      TEXT,
  complemento TEXT,
  bairro      TEXT,
  cidade      TEXT,
  estado      CHAR(2),
  obs         TEXT,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_nome     ON public.clientes(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf      ON public.clientes(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_ativo    ON public.clientes(ativo);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso clientes" ON public.clientes USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON public.clientes;
CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- View clientes
CREATE OR REPLACE VIEW public.v_clientes AS
SELECT * FROM public.clientes;

-- ══════════════════════════════════════════════════════════════════
-- CATEGORIAS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.categorias (
  id         BIGSERIAL PRIMARY KEY,
  nome       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso categorias" ON public.categorias USING (true) WITH CHECK (true);

INSERT INTO public.categorias (nome) VALUES
  ('Roupas Femininas'), ('Roupas Masculinas'), ('Roupas Infantis'),
  ('Calçados'), ('Bolsas & Acessórios'), ('Cama, Mesa & Banho'),
  ('Decoração'), ('Outros')
ON CONFLICT (nome) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- PRODUTOS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.produtos (
  id           BIGSERIAL PRIMARY KEY,
  codigo       TEXT        NOT NULL UNIQUE,
  nome         TEXT        NOT NULL,
  descricao    TEXT,
  categoria_id BIGINT      REFERENCES categorias(id) ON DELETE SET NULL,
  preco        NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_custo  NUMERIC(10,2) DEFAULT 0,
  estoque      INT         NOT NULL DEFAULT 0,
  estoque_min  INT         NOT NULL DEFAULT 0,
  tamanho      TEXT,
  cor          TEXT,
  marca        TEXT,
  condicao     TEXT        DEFAULT 'usado' CHECK (condicao IN ('novo','usado','seminovo')),
  foto_url     TEXT,
  ativo        BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_codigo   ON public.produtos(codigo);
CREATE INDEX IF NOT EXISTS idx_produtos_nome     ON public.produtos(nome);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo    ON public.produtos(ativo);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso produtos" ON public.produtos USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_produtos_updated_at ON public.produtos;
CREATE TRIGGER trg_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Próximo código de produto
CREATE OR REPLACE FUNCTION fn_next_produto_codigo()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 2) AS INT)), 0) + 1
    INTO v_num FROM public.produtos WHERE codigo ~ '^P[0-9]+$';
  RETURN 'P' || LPAD(v_num::TEXT, 4, '0');
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- VENDAS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vendas (
  id              BIGSERIAL PRIMARY KEY,
  cliente_id      BIGINT      REFERENCES clientes(id) ON DELETE SET NULL,
  vendedor_id     BIGINT      REFERENCES usuarios(id) ON DELETE SET NULL,
  status          TEXT        NOT NULL DEFAULT 'concluida' CHECK (status IN ('pendente','concluida','cancelada')),
  forma_pagamento TEXT        NOT NULL DEFAULT 'dinheiro',
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  obs             TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.venda_itens (
  id         BIGSERIAL PRIMARY KEY,
  venda_id   BIGINT      NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id BIGINT      REFERENCES produtos(id) ON DELETE SET NULL,
  nome       TEXT        NOT NULL,
  preco_unit NUMERIC(10,2) NOT NULL,
  qtd        INT         NOT NULL DEFAULT 1,
  subtotal   NUMERIC(10,2) NOT NULL
);

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso vendas" ON public.vendas USING (true) WITH CHECK (true);
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso venda_itens" ON public.venda_itens USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_vendas_updated_at ON public.vendas;
CREATE TRIGGER trg_vendas_updated_at
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- View vendas
CREATE OR REPLACE VIEW public.v_vendas AS
SELECT v.*, c.nome AS cliente_nome, u.nome AS vendedor_nome
FROM public.vendas v
LEFT JOIN public.clientes c ON c.id = v.cliente_id
LEFT JOIN public.usuarios u ON u.id = v.vendedor_id;

-- Criar venda
CREATE OR REPLACE FUNCTION fn_criar_venda(
  p_cliente_id BIGINT, p_vendedor_id BIGINT, p_forma_pagamento TEXT,
  p_desconto NUMERIC, p_obs TEXT,
  p_itens JSONB
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_id      BIGINT;
  v_subtotal NUMERIC := 0;
  v_total   NUMERIC;
  item      JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_subtotal := v_subtotal + (item->>'preco_unit')::NUMERIC * (item->>'qtd')::INT;
  END LOOP;
  v_total := GREATEST(0, v_subtotal - COALESCE(p_desconto, 0));

  INSERT INTO public.vendas (cliente_id, vendedor_id, forma_pagamento, subtotal, desconto, total, obs, status)
  VALUES (p_cliente_id, p_vendedor_id, p_forma_pagamento, v_subtotal, COALESCE(p_desconto,0), v_total, p_obs, 'concluida')
  RETURNING id INTO v_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    INSERT INTO public.venda_itens (venda_id, produto_id, nome, preco_unit, qtd, subtotal)
    VALUES (v_id, NULLIF((item->>'produto_id'),'')::BIGINT, item->>'nome',
            (item->>'preco_unit')::NUMERIC, (item->>'qtd')::INT,
            (item->>'preco_unit')::NUMERIC * (item->>'qtd')::INT);
    IF (item->>'produto_id') IS NOT NULL THEN
      UPDATE public.produtos SET estoque = estoque - (item->>'qtd')::INT WHERE id = (item->>'produto_id')::BIGINT;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('id', v_id, 'total', v_total);
END;
$$;

-- Cancelar venda
CREATE OR REPLACE FUNCTION fn_cancelar_venda(p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.vendas SET status = 'cancelada' WHERE id = p_id;
  UPDATE public.produtos p SET estoque = p.estoque + vi.qtd
  FROM public.venda_itens vi WHERE vi.venda_id = p_id AND vi.produto_id = p.id;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- FINANCEIRO
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id           BIGSERIAL PRIMARY KEY,
  descricao    TEXT        NOT NULL,
  valor        NUMERIC(10,2) NOT NULL,
  vencimento   DATE        NOT NULL,
  pago_em      DATE,
  status       TEXT        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  categoria    TEXT,
  obs          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contas_receber (
  id           BIGSERIAL PRIMARY KEY,
  descricao    TEXT        NOT NULL,
  valor        NUMERIC(10,2) NOT NULL,
  vencimento   DATE        NOT NULL,
  recebido_em  DATE,
  status       TEXT        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','recebido','cancelado')),
  cliente_id   BIGINT      REFERENCES clientes(id) ON DELETE SET NULL,
  venda_id     BIGINT      REFERENCES vendas(id) ON DELETE SET NULL,
  obs          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso contas_pagar" ON public.contas_pagar USING (true) WITH CHECK (true);
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso contas_receber" ON public.contas_receber USING (true) WITH CHECK (true);

CREATE OR REPLACE VIEW public.v_contas_receber AS
SELECT cr.*, c.nome AS cliente_nome FROM public.contas_receber cr
LEFT JOIN public.clientes c ON c.id = cr.cliente_id;

CREATE OR REPLACE FUNCTION fn_resumo_financeiro()
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_receber NUMERIC; v_pagar NUMERIC; v_recebido NUMERIC; v_pago NUMERIC;
BEGIN
  SELECT COALESCE(SUM(valor),0) INTO v_receber FROM public.contas_receber WHERE status='pendente';
  SELECT COALESCE(SUM(valor),0) INTO v_pagar  FROM public.contas_pagar  WHERE status='pendente';
  SELECT COALESCE(SUM(valor),0) INTO v_recebido FROM public.contas_receber WHERE status='recebido' AND DATE_TRUNC('month',recebido_em)=DATE_TRUNC('month',NOW());
  SELECT COALESCE(SUM(valor),0) INTO v_pago    FROM public.contas_pagar  WHERE status='pago' AND DATE_TRUNC('month',pago_em)=DATE_TRUNC('month',NOW());
  RETURN jsonb_build_object('a_receber',v_receber,'a_pagar',v_pagar,'recebido_mes',v_recebido,'pago_mes',v_pago);
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- TROCAS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.trocas (
  id          BIGSERIAL PRIMARY KEY,
  cliente_id  BIGINT      REFERENCES clientes(id) ON DELETE SET NULL,
  tipo        TEXT        NOT NULL DEFAULT 'troca' CHECK (tipo IN ('troca','devolucao')),
  status      TEXT        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','recusada','concluida')),
  motivo      TEXT,
  obs         TEXT,
  venda_id    BIGINT      REFERENCES vendas(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.trocas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso trocas" ON public.trocas USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_trocas_updated_at ON public.trocas;
CREATE TRIGGER trg_trocas_updated_at
  BEFORE UPDATE ON public.trocas
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE FUNCTION fn_atualizar_status_troca(p_id BIGINT, p_status TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN UPDATE public.trocas SET status = p_status WHERE id = p_id; END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- LIVES
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.lives (
  id          BIGSERIAL PRIMARY KEY,
  titulo      TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','ao_vivo','encerrada')),
  data_inicio TIMESTAMPTZ,
  data_fim    TIMESTAMPTZ,
  obs         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.live_compras (
  id         BIGSERIAL PRIMARY KEY,
  live_id    BIGINT      NOT NULL REFERENCES lives(id) ON DELETE CASCADE,
  cliente_id BIGINT      REFERENCES clientes(id) ON DELETE SET NULL,
  total      NUMERIC(10,2) NOT NULL DEFAULT 0,
  status     TEXT        NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.live_compra_itens (
  id            BIGSERIAL PRIMARY KEY,
  live_compra_id BIGINT   NOT NULL REFERENCES live_compras(id) ON DELETE CASCADE,
  produto_id    BIGINT    REFERENCES produtos(id) ON DELETE SET NULL,
  nome          TEXT      NOT NULL,
  preco_unit    NUMERIC(10,2) NOT NULL,
  qtd           INT       NOT NULL DEFAULT 1
);

ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso lives" ON public.lives USING (true) WITH CHECK (true);
ALTER TABLE public.live_compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso live_compras" ON public.live_compras USING (true) WITH CHECK (true);
ALTER TABLE public.live_compra_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso live_compra_itens" ON public.live_compra_itens USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════
-- CONFIGURAÇÕES
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.configuracoes (
  id         BIGSERIAL PRIMARY KEY,
  chave      TEXT        NOT NULL UNIQUE,
  valor      JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso configuracoes" ON public.configuracoes USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════
-- ETIQUETAS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.etiquetas (
  id          BIGSERIAL PRIMARY KEY,
  me_order_id TEXT        NOT NULL,
  me_protocol TEXT,
  me_tracking TEXT,
  venda_id    BIGINT      REFERENCES vendas(id) ON DELETE SET NULL,
  service_id  INT         NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending',
  cep_destino TEXT,
  label_url   TEXT,
  criado_por  BIGINT      REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso etiquetas" ON public.etiquetas USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════
-- RELATÓRIOS (funções)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_vendas_periodo(p_de DATE, p_ate DATE)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(t)) INTO v_result FROM (
    SELECT DATE(created_at) AS dia, COUNT(*) AS qtd, SUM(total) AS total
    FROM public.vendas WHERE status='concluida' AND DATE(created_at) BETWEEN p_de AND p_ate
    GROUP BY dia ORDER BY dia
  ) t;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION fn_produtos_mais_vendidos(p_de DATE, p_ate DATE, p_limit INT DEFAULT 10)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(t)) INTO v_result FROM (
    SELECT vi.nome, SUM(vi.qtd) AS qtd_vendida, SUM(vi.subtotal) AS receita
    FROM public.venda_itens vi
    JOIN public.vendas v ON v.id = vi.venda_id
    WHERE v.status='concluida' AND DATE(v.created_at) BETWEEN p_de AND p_ate
    GROUP BY vi.nome ORDER BY qtd_vendida DESC LIMIT p_limit
  ) t;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION fn_ticket_medio(p_de DATE, p_ate DATE)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'ticket_medio', COALESCE(AVG(total),0),
    'total_vendas', COUNT(*),
    'receita_total', COALESCE(SUM(total),0)
  ) INTO v_result
  FROM public.vendas WHERE status='concluida' AND DATE(created_at) BETWEEN p_de AND p_ate;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION fn_formas_pagamento(p_de DATE, p_ate DATE)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(t)) INTO v_result FROM (
    SELECT forma_pagamento, COUNT(*) AS qtd, SUM(total) AS total
    FROM public.vendas WHERE status='concluida' AND DATE(created_at) BETWEEN p_de AND p_ate
    GROUP BY forma_pagamento ORDER BY total DESC
  ) t;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION fn_trocas_motivos(p_de DATE, p_ate DATE)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(t)) INTO v_result FROM (
    SELECT COALESCE(motivo,'Não informado') AS motivo, COUNT(*) AS qtd
    FROM public.trocas WHERE DATE(created_at) BETWEEN p_de AND p_ate
    GROUP BY motivo ORDER BY qtd DESC
  ) t;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION fn_fluxo_caixa(p_de DATE, p_ate DATE)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(t)) INTO v_result FROM (
    SELECT d AS dia,
      COALESCE((SELECT SUM(valor) FROM public.contas_receber WHERE recebido_em=d AND status='recebido'),0) AS entradas,
      COALESCE((SELECT SUM(valor) FROM public.contas_pagar WHERE pago_em=d AND status='pago'),0) AS saidas
    FROM generate_series(p_de::DATE, p_ate::DATE, '1 day'::INTERVAL) d
    ORDER BY d
  ) t;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- FIM DO SETUP
-- ══════════════════════════════════════════════════════════════════
