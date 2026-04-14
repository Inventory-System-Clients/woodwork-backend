CREATE INDEX IF NOT EXISTS idx_budgets_status_created_at
ON public.budgets (status, created_at);

CREATE INDEX IF NOT EXISTS idx_budgets_status_updated_at
ON public.budgets (status, updated_at);
