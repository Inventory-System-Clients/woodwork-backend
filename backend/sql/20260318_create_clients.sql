CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT,
  document TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  secondary_phone TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS company_name TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS document TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS contact_name TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS secondary_phone TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS street TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS number TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS complement TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS neighborhood TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS state TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS postal_code TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.clients
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

UPDATE public.clients
SET name = COALESCE(NULLIF(BTRIM(name), ''), NULLIF(BTRIM(company_name), ''), 'Cliente sem nome')
WHERE name IS NULL OR BTRIM(name) = '';

ALTER TABLE public.clients
ALTER COLUMN name SET NOT NULL;

ALTER TABLE public.clients
ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

ALTER TABLE public.clients
ALTER COLUMN metadata SET NOT NULL;

ALTER TABLE public.clients
ALTER COLUMN is_active SET DEFAULT TRUE;

ALTER TABLE public.clients
ALTER COLUMN is_active SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_unique
ON public.clients (LOWER(email))
WHERE email IS NOT NULL AND BTRIM(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_document_unique
ON public.clients (LOWER(document))
WHERE document IS NOT NULL AND BTRIM(document) <> '';

CREATE INDEX IF NOT EXISTS idx_clients_name
ON public.clients (LOWER(name));

CREATE INDEX IF NOT EXISTS idx_clients_is_active
ON public.clients (is_active);

CREATE INDEX IF NOT EXISTS idx_clients_created_at
ON public.clients (created_at DESC);
