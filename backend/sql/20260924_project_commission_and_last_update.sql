-- Custos de projeto que sao comissao (funcionario que recebe + percentual ou valor)
-- e "descricao da ultima atualizacao" exibida no link publico do cliente.
ALTER TABLE public.production_expenses
ADD COLUMN IF NOT EXISTS is_commission BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.production_expenses
ADD COLUMN IF NOT EXISTS commission_employee_id TEXT NULL;

ALTER TABLE public.production_expenses
ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(6, 2) NULL;

CREATE INDEX IF NOT EXISTS idx_production_expenses_commission_employee
ON public.production_expenses (commission_employee_id)
WHERE is_commission;

ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS last_update_note TEXT NULL;

ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS last_update_at TIMESTAMPTZ NULL;
