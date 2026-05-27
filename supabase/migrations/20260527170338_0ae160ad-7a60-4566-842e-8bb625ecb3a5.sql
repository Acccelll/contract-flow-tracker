ALTER TABLE public.cronograma_itens ADD COLUMN IF NOT EXISTS custo_baseline numeric(14,2);
UPDATE public.cronograma_itens SET custo_baseline = custo WHERE custo_baseline IS NULL;