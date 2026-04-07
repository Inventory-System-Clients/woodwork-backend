-- Add team category (interna | terceirizada)
-- Run this script in PostgreSQL (DBeaver).

ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE public.teams
SET category = 'interna'
WHERE category IS NULL OR BTRIM(category) = '';

ALTER TABLE public.teams
ALTER COLUMN category SET NOT NULL;

ALTER TABLE public.teams
ALTER COLUMN category SET DEFAULT 'interna';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'teams'
      AND constraint_name = 'chk_teams_category'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT chk_teams_category
      CHECK (category IN ('interna', 'terceirizada'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teams_category
ON public.teams (category);
