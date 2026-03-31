ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'executivo';

ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS chk_budgets_category,
  ADD CONSTRAINT chk_budgets_category
    CHECK (category IN ('arquitetonico', 'executivo'));

CREATE INDEX IF NOT EXISTS idx_budgets_category
ON public.budgets (category);
