-- Proposta MVP (Projetos, Custos, Horas): status do projeto, custos pago/a pagar,
-- horas por projeto ou outra atividade e perfis apenas admin/funcionario.

-- 1) Status simples do projeto (editavel com um clique).
ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS project_status TEXT NOT NULL DEFAULT 'Em andamento';

UPDATE public.production_orders
SET project_status = 'Finalizado'
WHERE project_status = 'Em andamento'
  AND (
    LOWER(COALESCE(production_status, '')) LIKE '%approved%'
    OR LOWER(COALESCE(production_status, '')) LIKE '%aprovad%'
    OR LOWER(COALESCE(production_status, '')) LIKE '%delivered%'
    OR LOWER(COALESCE(production_status, '')) LIKE '%entreg%'
    OR LOWER(COALESCE(production_status, '')) LIKE '%completed%'
    OR LOWER(COALESCE(production_status, '')) LIKE '%concluid%'
  );

CREATE INDEX IF NOT EXISTS idx_production_orders_project_status
ON public.production_orders (project_status);

-- 2) Custos: fornecedor (opcional), pago sim/nao e data do pagamento.
-- Gastos ja lancados antes desta migracao ficam como pagos (DEFAULT TRUE so vale na criacao da coluna).
ALTER TABLE public.production_expenses
ADD COLUMN IF NOT EXISTS supplier TEXT NULL;

ALTER TABLE public.production_expenses
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.production_expenses
ADD COLUMN IF NOT EXISTS paid_at DATE NULL;

ALTER TABLE public.production_expenses
ALTER COLUMN is_paid SET DEFAULT FALSE;

UPDATE public.production_expenses
SET paid_at = created_at::date
WHERE is_paid = TRUE AND paid_at IS NULL;

-- 3) Horas: projeto OU outra atividade (texto livre), varias linhas por dia.
ALTER TABLE public.work_hours
ALTER COLUMN production_id DROP NOT NULL;

ALTER TABLE public.work_hours
ADD COLUMN IF NOT EXISTS activity TEXT NULL;

ALTER TABLE public.work_hours
DROP CONSTRAINT IF EXISTS uq_work_hours_employee_production_date;

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_hours_employee_project_date
ON public.work_hours (employee_id, production_id, work_date)
WHERE production_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_hours_employee_activity_date
ON public.work_hours (employee_id, work_date, LOWER(activity))
WHERE production_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_hours_production_id
ON public.work_hours (production_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'work_hours'
      AND constraint_name = 'chk_work_hours_project_or_activity'
  ) THEN
    ALTER TABLE public.work_hours
      ADD CONSTRAINT chk_work_hours_project_or_activity
      CHECK (production_id IS NOT NULL OR (activity IS NOT NULL AND LENGTH(TRIM(activity)) > 0));
  END IF;
END $$;

-- 4) Perfis: somente admin e funcionario (gerentes viram admin).
ALTER TABLE public.employees
DROP CONSTRAINT IF EXISTS chk_employees_role;

UPDATE public.employees
SET role = 'admin', updated_at = NOW()
WHERE role = 'gerente';

ALTER TABLE public.employees
ADD CONSTRAINT chk_employees_role CHECK (role IN ('admin', 'funcionario'));

-- 5) Projeto novo pede so nome, cliente e status: equipe/orcamento inicial deixam de ser obrigatorios.
ALTER TABLE public.production_orders
ALTER COLUMN installation_team DROP NOT NULL;
