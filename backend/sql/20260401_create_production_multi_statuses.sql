-- Multi-status workflow for production orders
-- Allows multiple editable stages per production, each with a responsible team.

CREATE TABLE IF NOT EXISTS public.production_status_stages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_production_status_stages_normalized_name
ON public.production_status_stages (normalized_name);

CREATE TABLE IF NOT EXISTS public.production_order_statuses (
  id TEXT PRIMARY KEY,
  production_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  team_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_production_order_statuses_unique_link
ON public.production_order_statuses (production_id, stage_id, team_id);

CREATE INDEX IF NOT EXISTS idx_production_order_statuses_production_id
ON public.production_order_statuses (production_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_order_statuses_stage_id
ON public.production_order_statuses (stage_id);

CREATE INDEX IF NOT EXISTS idx_production_order_statuses_team_id
ON public.production_order_statuses (team_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'production_order_statuses'
      AND constraint_name = 'fk_production_order_statuses_stage'
  ) THEN
    ALTER TABLE public.production_order_statuses
      ADD CONSTRAINT fk_production_order_statuses_stage
      FOREIGN KEY (stage_id)
      REFERENCES public.production_status_stages(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'production_order_statuses'
      AND constraint_name = 'fk_production_order_statuses_team'
  ) THEN
    ALTER TABLE public.production_order_statuses
      ADD CONSTRAINT fk_production_order_statuses_team
      FOREIGN KEY (team_id)
      REFERENCES public.teams(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Remove legacy strict constraint so production_orders.production_status can store free text if needed.
DO $$
DECLARE
  existing_constraint_name text;
BEGIN
  FOR existing_constraint_name IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.constraint_schema = tc.constraint_schema
    WHERE tc.constraint_schema = 'public'
      AND tc.table_name = 'production_orders'
      AND tc.constraint_type = 'CHECK'
      AND ccu.column_name = 'production_status'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.production_orders DROP CONSTRAINT %I',
      existing_constraint_name
    );
  END LOOP;
END $$;

-- Seed common stages.
INSERT INTO public.production_status_stages (id, name, normalized_name)
SELECT md5(random()::text || clock_timestamp()::text), seeded.name, seeded.normalized_name
FROM (
  VALUES
    ('Pendente', 'pendente'),
    ('Corte', 'corte'),
    ('Montagem', 'montagem'),
    ('Acabamento', 'acabamento'),
    ('Controle', 'controle'),
    ('Aprovado', 'aprovado'),
    ('Entregue', 'entregue')
) AS seeded(name, normalized_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.production_status_stages pss
  WHERE pss.normalized_name = seeded.normalized_name
);

-- Backfill one status assignment per production when none exists yet.
WITH resolved_source AS (
  SELECT
    po.id::text AS production_id,
    CASE
      WHEN LOWER(BTRIM(po.production_status::text)) IN ('pending', 'pendente') THEN 'pendente'
      WHEN LOWER(BTRIM(po.production_status::text)) IN ('cutting', 'corte') THEN 'corte'
      WHEN LOWER(BTRIM(po.production_status::text)) IN ('assembly', 'montagem') THEN 'montagem'
      WHEN LOWER(BTRIM(po.production_status::text)) IN ('finishing', 'acabamento') THEN 'acabamento'
      WHEN LOWER(BTRIM(po.production_status::text)) IN ('quality_check', 'quality check', 'controle') THEN 'controle'
      WHEN LOWER(BTRIM(po.production_status::text)) IN ('approved', 'aprovado') THEN 'aprovado'
      WHEN LOWER(BTRIM(po.production_status::text)) IN ('delivered', 'entregue', 'completed', 'concluido', 'concluida') THEN 'entregue'
      WHEN po.production_status IS NULL OR BTRIM(po.production_status::text) = '' THEN 'pendente'
      ELSE LOWER(BTRIM(po.production_status::text))
    END AS normalized_stage,
    po.production_status::text AS original_stage,
    po.installation_team_id
  FROM public.production_orders po
),
seed_custom_stages AS (
  INSERT INTO public.production_status_stages (id, name, normalized_name)
  SELECT
    md5(random()::text || clock_timestamp()::text || rs.normalized_stage),
    CASE
      WHEN rs.original_stage IS NULL OR BTRIM(rs.original_stage) = '' THEN rs.normalized_stage
      ELSE BTRIM(rs.original_stage)
    END,
    rs.normalized_stage
  FROM resolved_source rs
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.production_status_stages pss
    WHERE pss.normalized_name = rs.normalized_stage
  )
  GROUP BY rs.normalized_stage, rs.original_stage
)
INSERT INTO public.production_order_statuses (id, production_id, stage_id, team_id)
SELECT
  md5(random()::text || clock_timestamp()::text || rs.production_id || pss.id),
  rs.production_id,
  pss.id,
  rs.installation_team_id
FROM resolved_source rs
INNER JOIN public.production_status_stages pss
  ON pss.normalized_name = rs.normalized_stage
WHERE NOT EXISTS (
  SELECT 1
  FROM public.production_order_statuses pos
  WHERE pos.production_id = rs.production_id
);