
ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS uid_mpp TEXT,
  ADD COLUMN IF NOT EXISTS data_inicio_baseline DATE,
  ADD COLUMN IF NOT EXISTS data_fim_baseline DATE,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_cronograma_itens_obra_uid ON public.cronograma_itens(obra_id, uid_mpp);

CREATE TABLE IF NOT EXISTS public.cronograma_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL,
  numero INTEGER NOT NULL,
  data_corte DATE NOT NULL,
  arquivo_nome TEXT,
  observacoes TEXT,
  totais JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_revisoes TO authenticated;
GRANT ALL ON public.cronograma_revisoes TO service_role;

ALTER TABLE public.cronograma_revisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own cronograma_revisoes" ON public.cronograma_revisoes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = cronograma_revisoes.obra_id AND o.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = cronograma_revisoes.obra_id AND o.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.cronograma_item_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id UUID NOT NULL REFERENCES public.cronograma_revisoes(id) ON DELETE CASCADE,
  cronograma_item_id UUID NOT NULL,
  data_inicio_anterior DATE,
  data_inicio_novo DATE,
  data_fim_anterior DATE,
  data_fim_novo DATE,
  percentual_realizado_anterior NUMERIC(7,4),
  percentual_realizado_novo NUMERIC(7,4),
  custo_anterior NUMERIC(14,2),
  custo_novo NUMERIC(14,2),
  tipo_mudanca TEXT NOT NULL,
  descricao_item TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cronograma_item_revisoes_revisao ON public.cronograma_item_revisoes(revisao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_item_revisoes TO authenticated;
GRANT ALL ON public.cronograma_item_revisoes TO service_role;

ALTER TABLE public.cronograma_item_revisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own cronograma_item_revisoes" ON public.cronograma_item_revisoes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cronograma_revisoes r
    JOIN public.obras o ON o.id = r.obra_id
    WHERE r.id = cronograma_item_revisoes.revisao_id AND o.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cronograma_revisoes r
    JOIN public.obras o ON o.id = r.obra_id
    WHERE r.id = cronograma_item_revisoes.revisao_id AND o.owner_id = auth.uid()
  ));
