-- PDF de entrega ao cliente: mao de obra, desconto e data de finalizacao do projeto.
ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS labor_value NUMERIC(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS discount_value NUMERIC(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ NULL;

-- Projetos ja finalizados: usa a ultima alteracao como data de finalizacao.
UPDATE public.production_orders
SET finished_at = COALESCE(updated_at, NOW())
WHERE project_status = 'Finalizado' AND finished_at IS NULL;
