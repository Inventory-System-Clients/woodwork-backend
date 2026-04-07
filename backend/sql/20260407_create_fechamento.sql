-- Fechamento mensal da logistica
-- Execute este script no PostgreSQL via DBeaver.

CREATE TABLE IF NOT EXISTS public.fechamento (
  id TEXT PRIMARY KEY,
  reference_month DATE NOT NULL,
  custo_geral_ativo NUMERIC(14,2) NOT NULL DEFAULT 0,
  receita_vinculada NUMERIC(14,2) NOT NULL DEFAULT 0,
  lucro_liquido NUMERIC(14,2) NOT NULL DEFAULT 0,
  lucro_bruto NUMERIC(14,2) NOT NULL DEFAULT 0,
  custos_aplicados_pre_aprovados NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fechamento_custo_geral_ativo_non_negative
    CHECK (custo_geral_ativo >= 0),
  CONSTRAINT chk_fechamento_receita_vinculada_non_negative
    CHECK (receita_vinculada >= 0),
  CONSTRAINT chk_fechamento_custos_aplicados_pre_aprovados_non_negative
    CHECK (custos_aplicados_pre_aprovados >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fechamento_reference_month
ON public.fechamento (reference_month);

CREATE INDEX IF NOT EXISTS idx_fechamento_reference_month_desc
ON public.fechamento (reference_month DESC);
