-- CPF/CNPJ do cliente informado ao criar o projeto (exibido no PDF de entrega).
ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS client_document TEXT NULL;
