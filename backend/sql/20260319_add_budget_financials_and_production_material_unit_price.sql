ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_margin NUMERIC(10,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_cost NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS chk_budgets_total_cost_nonnegative,
  ADD CONSTRAINT chk_budgets_total_cost_nonnegative
    CHECK (total_cost >= 0),
  DROP CONSTRAINT IF EXISTS chk_budgets_profit_margin_range,
  ADD CONSTRAINT chk_budgets_profit_margin_range
    CHECK (profit_margin >= 0 AND profit_margin <= 1),
  DROP CONSTRAINT IF EXISTS chk_budgets_profit_value_nonnegative,
  ADD CONSTRAINT chk_budgets_profit_value_nonnegative
    CHECK (profit_value >= 0),
  DROP CONSTRAINT IF EXISTS chk_budgets_labor_cost_nonnegative,
  ADD CONSTRAINT chk_budgets_labor_cost_nonnegative
    CHECK (labor_cost >= 0);

ALTER TABLE public.budget_materials
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(14,2);

ALTER TABLE public.budget_materials
  DROP CONSTRAINT IF EXISTS chk_budget_materials_unit_price_nonnegative,
  ADD CONSTRAINT chk_budget_materials_unit_price_nonnegative
    CHECK (unit_price IS NULL OR unit_price >= 0);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'production_order_materials'
  ) THEN
    EXECUTE '
      ALTER TABLE public.production_order_materials
      ADD COLUMN IF NOT EXISTS unit_price NUMERIC(14,2)
    ';

    EXECUTE '
      UPDATE public.production_order_materials
      SET unit_price = 0
      WHERE unit_price IS NULL
    ';

    EXECUTE '
      ALTER TABLE public.production_order_materials
      ALTER COLUMN unit_price SET DEFAULT 0
    ';

    EXECUTE '
      ALTER TABLE public.production_order_materials
      DROP CONSTRAINT IF EXISTS chk_production_order_materials_unit_price_nonnegative
    ';

    EXECUTE '
      ALTER TABLE public.production_order_materials
      ADD CONSTRAINT chk_production_order_materials_unit_price_nonnegative
      CHECK (unit_price >= 0)
    ';
  END IF;
END
$$;
