ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS percentual_realizado NUMERIC(7,4) NOT NULL DEFAULT 0;

ALTER TABLE public.medicoes
  ADD COLUMN IF NOT EXISTS data_inicio DATE;

ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS competencia          DATE,
  ADD COLUMN IF NOT EXISTS valor_servicos       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS inss_retido          NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iss_retido           NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outras_retencoes     NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_liquido        NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS codigo_verificacao   TEXT,
  ADD COLUMN IF NOT EXISTS tomador_nome         TEXT,
  ADD COLUMN IF NOT EXISTS tomador_cnpj         TEXT;