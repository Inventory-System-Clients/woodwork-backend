-- Projeto/producao nasce so com os campos iniciais: prazo e equipe passam a ser opcionais.
-- (Comandos idempotentes: DROP NOT NULL em coluna ja anulavel nao faz nada.)
ALTER TABLE public.production_orders
ALTER COLUMN delivery_date DROP NOT NULL;

ALTER TABLE public.production_orders
ALTER COLUMN installation_team DROP NOT NULL;

ALTER TABLE public.production_orders
ALTER COLUMN initial_cost SET DEFAULT 0;
