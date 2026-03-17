CREATE INDEX IF NOT EXISTS idx_production_orders_status_delivery_date
ON public.production_orders (production_status, delivery_date);

CREATE INDEX IF NOT EXISTS idx_production_order_materials_production_order_id
ON public.production_order_materials (production_order_id);

CREATE INDEX IF NOT EXISTS idx_employees_is_active
ON public.employees (is_active);
