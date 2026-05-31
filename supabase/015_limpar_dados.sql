-- ══════════════════════════════════════════════════════════════════
-- 015 — LIMPAR TODOS OS DADOS DO BANCO
-- ⚠️  DESTRUTIVO: apaga TODAS as linhas de todas as tabelas.
--     As tabelas e estrutura permanecem intactas.
--     Execute UMA vez no Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════

-- Desabilitar triggers temporariamente para evitar conflitos
SET session_replication_role = 'replica';

-- Tabelas dependentes primeiro (ordem de FK)
TRUNCATE public.venda_itens            CASCADE;
TRUNCATE public.contas_receber         CASCADE;
TRUNCATE public.contas_pagar           CASCADE;
TRUNCATE public.trocas                 CASCADE;
TRUNCATE public.vendas                 CASCADE;
TRUNCATE public.live_compra_produtos   CASCADE;
TRUNCATE public.live_compras           CASCADE;
TRUNCATE public.lives                  CASCADE;
TRUNCATE public.etiquetas              CASCADE;
TRUNCATE public.produtos               CASCADE;
TRUNCATE public.categorias             CASCADE;
TRUNCATE public.marcas                 CASCADE;
TRUNCATE public.clientes               CASCADE;

-- Reabilitar triggers
SET session_replication_role = 'origin';

-- Resetar sequences (IDs voltam a 1)
DO $$
DECLARE
  seq RECORD;
BEGIN
  FOR seq IN
    SELECT c.oid::regclass::text AS seqname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S' AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE %s RESTART WITH 1', seq.seqname);
  END LOOP;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- PRONTO — banco limpo, estrutura intacta, IDs resetados.
-- ══════════════════════════════════════════════════════════════════
