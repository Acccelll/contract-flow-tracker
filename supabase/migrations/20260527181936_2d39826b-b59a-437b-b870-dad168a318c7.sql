CREATE TABLE public.cronograma_dependencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.cronograma_itens(id) ON DELETE CASCADE,
  predecessor_uid_mpp text NOT NULL,
  tipo text NOT NULL DEFAULT 'FS',
  lag_dias integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dep_item ON public.cronograma_dependencias(item_id);
CREATE INDEX idx_dep_obra ON public.cronograma_dependencias(obra_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_dependencias TO authenticated;
GRANT ALL ON public.cronograma_dependencias TO service_role;

ALTER TABLE public.cronograma_dependencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own dependencias" ON public.cronograma_dependencias
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = cronograma_dependencias.obra_id AND o.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = cronograma_dependencias.obra_id AND o.owner_id = auth.uid()));

-- Coluna para sinalizar item crítico (folga ≤ 0) — calculado e gravado pelo client após CPM
ALTER TABLE public.cronograma_itens ADD COLUMN IF NOT EXISTS folga_dias integer;
ALTER TABLE public.cronograma_itens ADD COLUMN IF NOT EXISTS critico boolean NOT NULL DEFAULT false;