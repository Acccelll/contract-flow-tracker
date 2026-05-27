
-- Expandir enum medicao_status
ALTER TYPE public.medicao_status ADD VALUE IF NOT EXISTS 'em_revisao';
ALTER TYPE public.medicao_status ADD VALUE IF NOT EXISTS 'faturada';
ALTER TYPE public.medicao_status ADD VALUE IF NOT EXISTS 'cancelada';

-- Expandir enum recebimento_status
ALTER TYPE public.recebimento_status ADD VALUE IF NOT EXISTS 'parcial';
ALTER TYPE public.recebimento_status ADD VALUE IF NOT EXISTS 'recebido';
ALTER TYPE public.recebimento_status ADD VALUE IF NOT EXISTS 'inadimplente';
ALTER TYPE public.recebimento_status ADD VALUE IF NOT EXISTS 'cancelado';

-- Enum próprio para notas fiscais
DO $$ BEGIN
  CREATE TYPE public.nf_status AS ENUM ('rascunho','emitida','enviada','aprovada_cliente','recebida','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS status public.nf_status NOT NULL DEFAULT 'emitida';
