ALTER TABLE public.production_order_materials
ADD COLUMN IF NOT EXISTS product_id TEXT;

CREATE INDEX IF NOT EXISTS idx_pom_product_id
ON public.production_order_materials(product_id);
