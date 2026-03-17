CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT,
  stock_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(14,3) NOT NULL DEFAULT 0;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS name TEXT;

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

CREATE INDEX IF NOT EXISTS idx_products_stock_quantity
ON public.products (stock_quantity);

CREATE INDEX IF NOT EXISTS idx_product_stock_movements_product_id
ON public.product_stock_movements (product_id);

CREATE INDEX IF NOT EXISTS idx_product_stock_movements_created_at
ON public.product_stock_movements (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_stock_movements_reference
ON public.product_stock_movements (reference_type, reference_id);
