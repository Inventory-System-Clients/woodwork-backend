-- Lucro (%) e comissao de funcionario (%) definidos depois que a producao ja existe.
ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS profit_percent NUMERIC(6, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(6, 2) NOT NULL DEFAULT 0;

-- Producao nasce so com os campos iniciais (custo inicial e opcional).
ALTER TABLE public.production_orders
ALTER COLUMN initial_cost SET DEFAULT 0;
