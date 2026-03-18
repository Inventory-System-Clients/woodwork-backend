-- Public production share links
-- Run this script in PostgreSQL (DBeaver) to enable token-based public tracking URLs.

CREATE TABLE IF NOT EXISTS public.production_share_links (
  id TEXT PRIMARY KEY,
  production_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ux_production_share_links_token_hash'
  ) THEN
    CREATE UNIQUE INDEX ux_production_share_links_token_hash
      ON public.production_share_links (token_hash);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_production_share_links_production_id'
  ) THEN
    CREATE INDEX idx_production_share_links_production_id
      ON public.production_share_links (production_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_production_share_links_active'
  ) THEN
    CREATE INDEX idx_production_share_links_active
      ON public.production_share_links (production_id, revoked_at, expires_at);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'production_share_links'
      AND constraint_name = 'fk_production_share_links_created_by_user'
  ) THEN
    ALTER TABLE public.production_share_links
      ADD CONSTRAINT fk_production_share_links_created_by_user
      FOREIGN KEY (created_by_user_id)
      REFERENCES public.employees(id)
      ON DELETE SET NULL;
  END IF;
END $$;
