ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS payment_terms TEXT;

-- Optional transition backfill:
-- UPDATE public.budgets
-- SET payment_terms = 'Pagamento: 50% fechamento e assinatura de contrato 50% restante a serem pagos 30 dias apos inicio da obra.\nPrazo previsto para entrega: 60 dias. Proposta valida por 5 dias.'
-- WHERE payment_terms IS NULL;
