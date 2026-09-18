CREATE TABLE IF NOT EXISTS public.work_hours (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  production_id TEXT NOT NULL,
  work_date DATE NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_work_hours_employee_production_date UNIQUE (employee_id, production_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_work_hours_employee_date
ON public.work_hours (employee_id, work_date DESC);
