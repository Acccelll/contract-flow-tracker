
-- Fase 2: motor de previsão
ALTER TABLE public.recebimentos
  ADD COLUMN IF NOT EXISTS valor_previsto_inicial numeric,
  ADD COLUMN IF NOT EXISTS congelado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cronograma_item_id uuid,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN public.recebimentos.valor_previsto_inicial IS 'Valor previsto original na geração inicial (não muda no recálculo)';
COMMENT ON COLUMN public.recebimentos.congelado IS 'Quando true, não entra no recálculo dinâmico';
COMMENT ON COLUMN public.recebimentos.origem IS 'manual | cronograma | antecipacao | nf';

CREATE INDEX IF NOT EXISTS idx_receb_obra ON public.recebimentos(obra_id);
CREATE INDEX IF NOT EXISTS idx_receb_crono ON public.recebimentos(cronograma_item_id);
