
-- Tabela de baselines (snapshot por obra)
CREATE TABLE public.cronograma_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  versao integer NOT NULL,
  motivo text NOT NULL CHECK (motivo IN ('import_inicial','aditivo','ajuste_manual')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (obra_id, versao)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_baselines TO authenticated;
GRANT ALL ON public.cronograma_baselines TO service_role;

ALTER TABLE public.cronograma_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own cronograma_baselines"
ON public.cronograma_baselines
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = cronograma_baselines.obra_id AND o.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = cronograma_baselines.obra_id AND o.owner_id = auth.uid()));

CREATE INDEX idx_baselines_obra ON public.cronograma_baselines(obra_id, versao DESC);

-- Linhas do snapshot
CREATE TABLE public.cronograma_item_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id uuid NOT NULL REFERENCES public.cronograma_baselines(id) ON DELETE CASCADE,
  cronograma_item_id uuid NOT NULL,
  uid_mpp text,
  descricao text,
  custo numeric NOT NULL DEFAULT 0,
  data_inicio date,
  data_fim date,
  percentual_previsto numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_item_baseline TO authenticated;
GRANT ALL ON public.cronograma_item_baseline TO service_role;

ALTER TABLE public.cronograma_item_baseline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own cronograma_item_baseline"
ON public.cronograma_item_baseline
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.cronograma_baselines b
  JOIN public.obras o ON o.id = b.obra_id
  WHERE b.id = cronograma_item_baseline.baseline_id AND o.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.cronograma_baselines b
  JOIN public.obras o ON o.id = b.obra_id
  WHERE b.id = cronograma_item_baseline.baseline_id AND o.owner_id = auth.uid()
));

CREATE INDEX idx_baseline_item_baseline ON public.cronograma_item_baseline(baseline_id);
CREATE INDEX idx_baseline_item_crono ON public.cronograma_item_baseline(cronograma_item_id);

-- medições passam a referenciar a baseline vigente
ALTER TABLE public.medicoes ADD COLUMN IF NOT EXISTS baseline_id uuid REFERENCES public.cronograma_baselines(id);

-- Auditoria: já existe trigger fn_audit_row; vamos anexar a baselines
DROP TRIGGER IF EXISTS trg_audit_baselines ON public.cronograma_baselines;
CREATE TRIGGER trg_audit_baselines
AFTER INSERT OR UPDATE OR DELETE ON public.cronograma_baselines
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

-- Migração de dados: cria v1 por obra que já tem cronograma
DO $$
DECLARE
  r record;
  v_baseline_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT obra_id
    FROM public.cronograma_itens
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cronograma_baselines b WHERE b.obra_id = cronograma_itens.obra_id
    )
  LOOP
    INSERT INTO public.cronograma_baselines (obra_id, versao, motivo, observacoes)
    VALUES (r.obra_id, 1, 'import_inicial', 'Baseline v1 criada na migração de versionamento')
    RETURNING id INTO v_baseline_id;

    INSERT INTO public.cronograma_item_baseline
      (baseline_id, cronograma_item_id, uid_mpp, descricao, custo, data_inicio, data_fim, percentual_previsto)
    SELECT
      v_baseline_id,
      ci.id,
      ci.uid_mpp,
      ci.descricao,
      COALESCE(ci.custo_baseline, ci.custo, 0),
      COALESCE(ci.data_inicio_baseline, ci.data_inicio),
      COALESCE(ci.data_fim_baseline, ci.data_fim),
      ci.percentual_previsto
    FROM public.cronograma_itens ci
    WHERE ci.obra_id = r.obra_id;

    -- vincula medições existentes à v1
    UPDATE public.medicoes SET baseline_id = v_baseline_id
    WHERE obra_id = r.obra_id AND baseline_id IS NULL;
  END LOOP;
END;
$$;
