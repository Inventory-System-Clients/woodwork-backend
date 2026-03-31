CREATE TABLE IF NOT EXISTS public.expense_departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  default_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_expense_departments_default_amount_nonnegative
    CHECK (default_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_expense_departments_name_sector
ON public.expense_departments (LOWER(BTRIM(name)), LOWER(BTRIM(sector)));

CREATE INDEX IF NOT EXISTS idx_expense_departments_sector
ON public.expense_departments (sector);

CREATE TABLE IF NOT EXISTS public.budget_expense_departments (
  id BIGSERIAL PRIMARY KEY,
  budget_id TEXT NOT NULL,
  expense_department_id TEXT,
  department_name TEXT NOT NULL,
  sector TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_budget_expense_departments_budget
    FOREIGN KEY (budget_id)
    REFERENCES public.budgets(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_budget_expense_departments_catalog
    FOREIGN KEY (expense_department_id)
    REFERENCES public.expense_departments(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_budget_expense_departments_amount_nonnegative
    CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_budget_expense_departments_budget_id
ON public.budget_expense_departments (budget_id);

CREATE INDEX IF NOT EXISTS idx_budget_expense_departments_catalog_id
ON public.budget_expense_departments (expense_department_id);
