ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS role TEXT;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS password_hash TEXT;

UPDATE public.employees
SET email = CONCAT('funcionario+', id, '@backwood.local')
WHERE email IS NULL
  OR TRIM(email) = '';

ALTER TABLE public.employees
ALTER COLUMN email SET NOT NULL;

UPDATE public.employees
SET role = 'funcionario'
WHERE role IS NULL
  OR TRIM(role) = '';

ALTER TABLE public.employees
ALTER COLUMN role SET DEFAULT 'funcionario';

ALTER TABLE public.employees
ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'employees'
      AND constraint_name = 'chk_employees_role'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT chk_employees_role
      CHECK (role IN ('admin', 'funcionario', 'gerente'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_role
ON public.employees (role);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.employees WHERE LOWER(email) = LOWER('admin@backwood.com')
  ) THEN
    UPDATE public.employees
    SET
      name = 'Administrador',
      role = 'admin',
      password_hash = '$2b$10$1iwvd7HaAnVZv2OIlfqmFeNJkN2v7SJANgoy5V2vc55HXy6gAixAG',
      is_active = TRUE,
      updated_at = NOW()
    WHERE LOWER(email) = LOWER('admin@backwood.com');
  ELSE
    INSERT INTO public.employees (id, name, email, role, password_hash, is_active)
    VALUES (
      'emp-admin-001',
      'Administrador',
      'admin@backwood.com',
      'admin',
      '$2b$10$1iwvd7HaAnVZv2OIlfqmFeNJkN2v7SJANgoy5V2vc55HXy6gAixAG',
      TRUE
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.employees WHERE LOWER(email) = LOWER('gerente@backwood.com')
  ) THEN
    UPDATE public.employees
    SET
      name = 'Gerente',
      role = 'gerente',
      password_hash = '$2b$10$1iwvd7HaAnVZv2OIlfqmFeNJkN2v7SJANgoy5V2vc55HXy6gAixAG',
      is_active = TRUE,
      updated_at = NOW()
    WHERE LOWER(email) = LOWER('gerente@backwood.com');
  ELSE
    INSERT INTO public.employees (id, name, email, role, password_hash, is_active)
    VALUES (
      'emp-manager-001',
      'Gerente',
      'gerente@backwood.com',
      'gerente',
      '$2b$10$1iwvd7HaAnVZv2OIlfqmFeNJkN2v7SJANgoy5V2vc55HXy6gAixAG',
      TRUE
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.employees WHERE LOWER(email) = LOWER('funcionario@backwood.com')
  ) THEN
    UPDATE public.employees
    SET
      name = 'Funcionario',
      role = 'funcionario',
      password_hash = '$2b$10$1iwvd7HaAnVZv2OIlfqmFeNJkN2v7SJANgoy5V2vc55HXy6gAixAG',
      is_active = TRUE,
      updated_at = NOW()
    WHERE LOWER(email) = LOWER('funcionario@backwood.com');
  ELSE
    INSERT INTO public.employees (id, name, email, role, password_hash, is_active)
    VALUES (
      'emp-worker-001',
      'Funcionario',
      'funcionario@backwood.com',
      'funcionario',
      '$2b$10$1iwvd7HaAnVZv2OIlfqmFeNJkN2v7SJANgoy5V2vc55HXy6gAixAG',
      TRUE
    );
  END IF;
END $$;

-- Senha inicial para os usuarios acima: Senha@123
-- Recomenda-se trocar a senha imediatamente apos o primeiro acesso.
