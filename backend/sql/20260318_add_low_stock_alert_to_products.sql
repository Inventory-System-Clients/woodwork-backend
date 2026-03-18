ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS low_stock_alert_quantity NUMERIC(14,3) NOT NULL DEFAULT 0;

UPDATE public.products
SET low_stock_alert_quantity = 0
WHERE low_stock_alert_quantity IS NULL OR low_stock_alert_quantity < 0;

ALTER TABLE public.products
ALTER COLUMN low_stock_alert_quantity SET DEFAULT 0;

ALTER TABLE public.products
ALTER COLUMN low_stock_alert_quantity SET NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_products_low_stock_alert_quantity
ON public.products (low_stock_alert_quantity);
