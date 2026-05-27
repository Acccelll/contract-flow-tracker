
-- =========================================================
-- ONDA 1.4 - AUDITORIA GENÉRICA
-- =========================================================

-- 1) Tabela de logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NULL,
  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('insert','update','delete','approve','cancel')),
  before jsonb NULL,
  after jsonb NULL,
  user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_obra ON public.audit_logs(obra_id, created_at DESC);
CREATE INDEX idx_audit_logs_entidade ON public.audit_logs(entidade, entidade_id);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Usuário só lê logs das próprias obras
CREATE POLICY "own audit_logs read"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  obra_id IS NULL
  OR EXISTS (SELECT 1 FROM public.obras o WHERE o.id = audit_logs.obra_id AND o.owner_id = auth.uid())
);

-- Bloqueia escrita direta - apenas triggers (SECURITY DEFINER) gravam
-- (sem CREATE POLICY for INSERT/UPDATE/DELETE => nenhum INSERT direto passa)

-- 2) Função genérica de auditoria
CREATE OR REPLACE FUNCTION public.fn_audit_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obra_id uuid;
  v_acao text;
  v_before jsonb;
  v_after jsonb;
  v_entidade_id uuid;
BEGIN
  -- Determina ação
  IF (TG_OP = 'INSERT') THEN
    v_acao := 'insert';
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_entidade_id := NEW.id;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_acao := 'update';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_entidade_id := NEW.id;
  ELSIF (TG_OP = 'DELETE') THEN
    v_acao := 'delete';
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_entidade_id := OLD.id;
  END IF;

  -- Extrai obra_id do payload (direto ou via medicao)
  v_obra_id := COALESCE(
    (CASE WHEN TG_OP = 'DELETE' THEN v_before ELSE v_after END) ->> 'obra_id',
    NULL
  )::uuid;

  -- Se a entidade não tem obra_id direto, tenta resolver via medicao_id
  IF v_obra_id IS NULL THEN
    DECLARE
      v_med_id uuid;
    BEGIN
      v_med_id := COALESCE(
        (CASE WHEN TG_OP = 'DELETE' THEN v_before ELSE v_after END) ->> 'medicao_id',
        NULL
      )::uuid;
      IF v_med_id IS NOT NULL THEN
        SELECT m.obra_id INTO v_obra_id FROM public.medicoes m WHERE m.id = v_med_id;
      END IF;
    END;
  END IF;

  INSERT INTO public.audit_logs (obra_id, entidade, entidade_id, acao, before, after, user_id)
  VALUES (v_obra_id, TG_TABLE_NAME, v_entidade_id, v_acao, v_before, v_after, auth.uid());

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3) Triggers nas tabelas existentes
CREATE TRIGGER trg_audit_medicoes
AFTER INSERT OR UPDATE OR DELETE ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

CREATE TRIGGER trg_audit_itens_medicao
AFTER INSERT OR UPDATE OR DELETE ON public.itens_medicao
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

CREATE TRIGGER trg_audit_notas_fiscais
AFTER INSERT OR UPDATE OR DELETE ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

CREATE TRIGGER trg_audit_recebimentos
AFTER INSERT OR UPDATE OR DELETE ON public.recebimentos
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();
