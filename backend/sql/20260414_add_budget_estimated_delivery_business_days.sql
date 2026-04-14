ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS estimated_delivery_business_days INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_budgets_estimated_delivery_business_days_positive'
      AND conrelid = 'public.budgets'::regclass
  ) THEN
    ALTER TABLE public.budgets
    ADD CONSTRAINT chk_budgets_estimated_delivery_business_days_positive
    CHECK (
      estimated_delivery_business_days IS NULL
      OR estimated_delivery_business_days > 0
    );
  END IF;
END $$;

-- Optional transition backfill:
-- UPDATE public.budgets
-- SET estimated_delivery_business_days = 60
-- WHERE estimated_delivery_business_days IS NULL
--   AND delivery_date IS NOT NULL;
