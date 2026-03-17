CREATE TABLE IF NOT EXISTS public.employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_unique
ON public.employees (LOWER(email))
WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_name_unique
ON public.teams (LOWER(name));

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, employee_id),
  CONSTRAINT fk_team_members_team
    FOREIGN KEY (team_id)
    REFERENCES public.teams(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_team_members_employee
    FOREIGN KEY (employee_id)
    REFERENCES public.employees(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_members_employee_id
ON public.team_members (employee_id);

ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS installation_team_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'production_orders'
      AND constraint_name = 'fk_production_orders_installation_team'
  ) THEN
    ALTER TABLE public.production_orders
      ADD CONSTRAINT fk_production_orders_installation_team
      FOREIGN KEY (installation_team_id)
      REFERENCES public.teams(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.production_orders po
SET installation_team_id = t.id
FROM public.teams t
WHERE po.installation_team_id IS NULL
  AND po.installation_team IS NOT NULL
  AND LOWER(po.installation_team) = LOWER(t.name);

CREATE INDEX IF NOT EXISTS idx_production_orders_installation_team_id
ON public.production_orders (installation_team_id);
