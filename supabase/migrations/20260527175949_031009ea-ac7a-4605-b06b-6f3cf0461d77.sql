
CREATE TYPE public.aditivo_status AS ENUM ('rascunho','aprovado','cancelado');
CREATE TYPE public.aditivo_tipo   AS ENUM ('acrescimo','supressao','reajuste','prazo','misto');

CREATE TABLE public.aditivos_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  numero text NOT NULL,
  tipo public.aditivo_tipo NOT NULL,
  valor_financeiro numeric NOT NULL DEFAULT 0,
  dias_prazo integer NOT NULL DEFAULT 0,
  data_aprovacao date,
  documento_url text,
  observacoes text,
  status public.aditivo_status NOT NULL DEFAULT 'rascunho',
  baseline_id uuid REFERENCES public.cronograma_baselines(id),
  versao_otimista integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aditivos_contrato TO authenticated;
GRANT ALL ON public.aditivos_contrato TO service_role;

ALTER TABLE public.aditivos_contrato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own aditivos"
ON public.aditivos_contrato FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = aditivos_contrato.obra_id AND o.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = aditivos_contrato.obra_id AND o.owner_id = auth.uid()));

CREATE INDEX idx_aditivos_obra ON public.aditivos_contrato(obra_id, status);

-- updated_at + versao_otimista
CREATE TRIGGER trg_touch_aditivos
BEFORE UPDATE ON public.aditivos_contrato
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_bump_versao_aditivos
BEFORE UPDATE ON public.aditivos_contrato
FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

-- Auditoria
CREATE TRIGGER trg_audit_aditivos
AFTER INSERT OR UPDATE OR DELETE ON public.aditivos_contrato
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

-- View com valores da obra
CREATE OR REPLACE VIEW public.vw_obra_valores AS
SELECT
  o.id AS obra_id,
  o.valor_contrato AS valor_contrato_original,
  o.valor_contrato + COALESCE((
    SELECT SUM(a.valor_financeiro) FROM public.aditivos_contrato a
    WHERE a.obra_id = o.id AND a.status = 'aprovado'
  ), 0) AS valor_contrato_atual,
  COALESCE((
    SELECT SUM(cib.custo)
    FROM public.cronograma_baselines b
    JOIN public.cronograma_item_baseline cib ON cib.baseline_id = b.id
    WHERE b.obra_id = o.id
      AND b.versao = (SELECT MAX(versao) FROM public.cronograma_baselines WHERE obra_id = o.id)
  ), 0) AS valor_planejado_baseline,
  COALESCE((
    SELECT SUM(im.valor_atual)
    FROM public.itens_medicao im
    JOIN public.medicoes m ON m.id = im.medicao_id
    WHERE m.obra_id = o.id AND m.status::text IN ('aprovada','faturada')
  ), 0) AS valor_executado,
  COALESCE((
    SELECT SUM(a.dias_prazo) FROM public.aditivos_contrato a
    WHERE a.obra_id = o.id AND a.status = 'aprovado'
  ), 0) AS dias_aditivos
FROM public.obras o;

ALTER VIEW public.vw_obra_valores SET (security_invoker = true);
GRANT SELECT ON public.vw_obra_valores TO authenticated;
