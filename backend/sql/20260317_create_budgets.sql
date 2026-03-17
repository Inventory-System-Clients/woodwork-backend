CREATE TABLE IF NOT EXISTS public.budgets (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_date TIMESTAMPTZ,
  total_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_budgets_status
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS public.budget_materials (
  id BIGSERIAL PRIMARY KEY,
  budget_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  unit_price NUMERIC(14,2) CHECK (unit_price IS NULL OR unit_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_budget_materials_budget
    FOREIGN KEY (budget_id)
    REFERENCES public.budgets(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_budgets_status
ON public.budgets (status);

CREATE INDEX IF NOT EXISTS idx_budgets_created_at
ON public.budgets (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_materials_budget_id
ON public.budget_materials (budget_id);

CREATE INDEX IF NOT EXISTS idx_budget_materials_product_id
ON public.budget_materials (product_id);
