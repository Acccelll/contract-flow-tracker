CREATE TABLE IF NOT EXISTS public.itens_medicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_id UUID NOT NULL REFERENCES public.medicoes(id) ON DELETE CASCADE,
  cronograma_item_id UUID NOT NULL REFERENCES public.cronograma_itens(id) ON DELETE RESTRICT,
  percentual_anterior NUMERIC(7,4) NOT NULL DEFAULT 0,
  percentual_atual    NUMERIC(7,4) NOT NULL DEFAULT 0,
  valor_anterior      NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_atual         NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (medicao_id, cronograma_item_id)
);

CREATE INDEX IF NOT EXISTS idx_itens_medicao_medicao ON public.itens_medicao(medicao_id);
CREATE INDEX IF NOT EXISTS idx_itens_medicao_crono   ON public.itens_medicao(cronograma_item_id);

ALTER TABLE public.itens_medicao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own itens_medicao" ON public.itens_medicao FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.medicoes m
      JOIN public.obras o ON o.id = m.obra_id
      WHERE m.id = itens_medicao.medicao_id
        AND o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.medicoes m
      JOIN public.obras o ON o.id = m.obra_id
      WHERE m.id = itens_medicao.medicao_id
        AND o.owner_id = auth.uid()
    )
  );