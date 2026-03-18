-- Production images persistence
-- Run this script in PostgreSQL (DBeaver) to store production images in database.

CREATE TABLE IF NOT EXISTS public.production_images (
  id TEXT PRIMARY KEY,
  production_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  image_data BYTEA NOT NULL,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_production_images_production_id'
  ) THEN
    CREATE INDEX idx_production_images_production_id
      ON public.production_images (production_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_production_images_created_at'
  ) THEN
    CREATE INDEX idx_production_images_created_at
      ON public.production_images (created_at DESC);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'production_images'
      AND constraint_name = 'chk_production_images_file_size_positive'
  ) THEN
    ALTER TABLE public.production_images
      ADD CONSTRAINT chk_production_images_file_size_positive
      CHECK (file_size > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'production_images'
      AND constraint_name = 'chk_production_images_mime_type_image'
  ) THEN
    ALTER TABLE public.production_images
      ADD CONSTRAINT chk_production_images_mime_type_image
      CHECK (mime_type LIKE 'image/%');
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
      AND table_name = 'production_images'
      AND constraint_name = 'fk_production_images_created_by_user'
  ) THEN
    ALTER TABLE public.production_images
      ADD CONSTRAINT fk_production_images_created_by_user
      FOREIGN KEY (created_by_user_id)
      REFERENCES public.employees(id)
      ON DELETE SET NULL;
  END IF;
END $$;
