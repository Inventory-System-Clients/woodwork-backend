CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT,
  stock_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  low_stock_alert_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(14,3) NOT NULL DEFAULT 0;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS low_stock_alert_quantity NUMERIC(14,3) NOT NULL DEFAULT 0;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.products
SET name = BTRIM(COALESCE(name, id))
WHERE name IS NULL OR BTRIM(name) = '';

UPDATE public.products
SET stock_quantity = 0
WHERE stock_quantity IS NULL OR stock_quantity < 0;

UPDATE public.products
SET low_stock_alert_quantity = 0
WHERE low_stock_alert_quantity IS NULL OR low_stock_alert_quantity < 0;

ALTER TABLE public.products
ALTER COLUMN name SET NOT NULL;

ALTER TABLE public.products
ALTER COLUMN stock_quantity SET NOT NULL;

ALTER TABLE public.products
ALTER COLUMN low_stock_alert_quantity SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_stock_quantity_non_negative'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_stock_quantity_non_negative
      CHECK (stock_quantity >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_low_stock_alert_non_negative'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_low_stock_alert_non_negative
      CHECK (low_stock_alert_quantity >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.product_stock_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit TEXT,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_product_stock_movements_type
    CHECK (movement_type IN ('entrada', 'saida'))
);

ALTER TABLE public.product_stock_movements
ADD COLUMN IF NOT EXISTS movement_type TEXT;

ALTER TABLE public.product_stock_movements
ADD COLUMN IF NOT EXISTS quantity NUMERIC(14,3);

ALTER TABLE public.product_stock_movements
ADD COLUMN IF NOT EXISTS reason TEXT;

ALTER TABLE public.product_stock_movements
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'product_stock_movements'
      AND constraint_name = 'fk_product_stock_movements_product'
  ) THEN
    ALTER TABLE public.product_stock_movements
      ADD CONSTRAINT fk_product_stock_movements_product
      FOREIGN KEY (product_id)
      REFERENCES public.products(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_stock_quantity
ON public.products (stock_quantity);

CREATE INDEX IF NOT EXISTS idx_products_low_stock_alert_quantity
ON public.products (low_stock_alert_quantity);

CREATE INDEX IF NOT EXISTS idx_products_name
ON public.products (LOWER(name));

CREATE INDEX IF NOT EXISTS idx_product_stock_movements_product_id
ON public.product_stock_movements (product_id);

CREATE INDEX IF NOT EXISTS idx_product_stock_movements_created_at
ON public.product_stock_movements (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_stock_movements_reference
ON public.product_stock_movements (reference_type, reference_id);
