CREATE TABLE IF NOT EXISTS public.production_expenses (
  id TEXT PRIMARY KEY,
  production_id TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_expenses_production_id
ON public.production_expenses (production_id, created_at DESC);
