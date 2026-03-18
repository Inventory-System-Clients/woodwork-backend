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
    WHERE tc.table_schema = 'public'
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

DO $$
DECLARE
  production_status_type text;
BEGIN
  SELECT
    pg_catalog.format_type(a.atttypid, a.atttypmod)
  INTO
    production_status_type
  FROM pg_attribute a
  JOIN pg_class c
    ON c.oid = a.attrelid
  JOIN pg_namespace n
    ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'production_orders'
    AND a.attname = 'production_status'
    AND a.attnum > 0
    AND NOT a.attisdropped
  LIMIT 1;

  IF production_status_type IS NULL THEN
    RAISE EXCEPTION 'Column public.production_orders.production_status not found';
  END IF;

  IF production_status_type <> 'text' THEN
    ALTER TABLE public.production_orders
      ALTER COLUMN production_status DROP DEFAULT;

    ALTER TABLE public.production_orders
      ALTER COLUMN production_status TYPE TEXT
      USING production_status::text;

    ALTER TABLE public.production_orders
      ALTER COLUMN production_status SET DEFAULT 'pending';
  END IF;
END $$;

UPDATE public.production_orders
SET production_status = CASE
  WHEN LOWER(BTRIM(production_status::text)) IN ('pending', 'pendente') THEN 'pending'
  WHEN LOWER(BTRIM(production_status::text)) IN ('cutting', 'corte') THEN 'cutting'
  WHEN LOWER(BTRIM(production_status::text)) IN ('assembly', 'montagem') THEN 'assembly'
  WHEN LOWER(BTRIM(production_status::text)) IN ('finishing', 'acabamento') THEN 'finishing'
  WHEN LOWER(BTRIM(production_status::text)) IN ('controle', 'quality_check', 'quality check') THEN 'quality_check'
  WHEN LOWER(BTRIM(production_status::text)) IN ('approved', 'aprovado') THEN 'approved'
  WHEN LOWER(BTRIM(production_status::text)) IN ('delivered', 'entregue', 'concluido', 'concluida', 'completed') THEN 'delivered'
  ELSE 'pending'
END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.constraint_schema = tc.constraint_schema
    WHERE tc.constraint_schema = 'public'
      AND tc.table_name = 'production_orders'
      AND tc.constraint_name = 'chk_production_orders_status'
  ) THEN
    ALTER TABLE public.production_orders
      ADD CONSTRAINT chk_production_orders_status
      CHECK (
        production_status::text IN (
          'pending',
          'cutting',
          'assembly',
          'finishing',
          'quality_check',
          'approved',
          'delivered'
        )
      );
  END IF;
END $$;
