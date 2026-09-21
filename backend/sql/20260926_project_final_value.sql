-- Valor final cobrado do cliente (opcional). Lucro = valor final - custos - comissoes.
ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS final_value NUMERIC(14, 2) NULL;
