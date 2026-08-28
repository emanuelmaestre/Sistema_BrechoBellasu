-- ══════════════════════════════════════════════════════════════
-- 046 — Rastro do aviso de penalidade por WhatsApp
-- Executar manualmente no Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Marca a última vez que a cliente recebeu o aviso de penalidade,
-- para a tela de penalidades mostrar "avisada há Xd" e evitar
-- reenvio duplicado sem querer.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS penalidade_aviso_em TIMESTAMPTZ;

-- Motivos de remoção estruturados (grupo curto), mantendo o texto
-- livre em motivo_remocao como detalhe complementar opcional.
ALTER TABLE public.penalidades_clientes
  ADD COLUMN IF NOT EXISTS motivo_remocao_grupo TEXT
    CHECK (motivo_remocao_grupo IS NULL OR motivo_remocao_grupo IN (
      'pagamento_confirmado',
      'prazo_renegociado',
      'retirada_cumprida',
      'engano_sistema',
      'acordo_negociado'
    ));
