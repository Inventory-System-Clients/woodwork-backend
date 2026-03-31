ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS costs_applicable_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costs_applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS costs_applied_value NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS chk_budgets_status,
  ADD CONSTRAINT chk_budgets_status
    CHECK (status IN ('draft', 'pending', 'pre_approved', 'approved', 'rejected')),
  DROP CONSTRAINT IF EXISTS chk_budgets_costs_applicable_value_nonnegative,
  ADD CONSTRAINT chk_budgets_costs_applicable_value_nonnegative
    CHECK (costs_applicable_value >= 0),
  DROP CONSTRAINT IF EXISTS chk_budgets_costs_applied_value_nonnegative,
  ADD CONSTRAINT chk_budgets_costs_applied_value_nonnegative
    CHECK (costs_applied_value >= 0);

UPDATE public.budgets
SET costs_applicable_value = GREATEST(COALESCE(total_cost, 0), 0)
WHERE costs_applicable_value IS NULL OR costs_applicable_value = 0;

UPDATE public.budgets
SET
  costs_applied_at = COALESCE(costs_applied_at, approved_at, NOW()),
  costs_applied_value = GREATEST(COALESCE(costs_applicable_value, 0), 0)
WHERE status IN ('pre_approved', 'approved');
