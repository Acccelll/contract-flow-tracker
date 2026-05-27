
-- Onda 1.1: validação de percentuais
ALTER TABLE public.cronograma_itens
  ADD CONSTRAINT cronograma_itens_pct_real_chk
  CHECK (percentual_realizado >= 0 AND percentual_realizado <= 100) NOT VALID;

ALTER TABLE public.cronograma_itens
  ADD CONSTRAINT cronograma_itens_pct_prev_chk
  CHECK (percentual_previsto >= 0 AND percentual_previsto <= 100) NOT VALID;

ALTER TABLE public.itens_medicao
  ADD CONSTRAINT itens_medicao_pct_atual_chk
  CHECK (percentual_atual >= 0 AND percentual_atual <= 100) NOT VALID;

ALTER TABLE public.itens_medicao
  ADD CONSTRAINT itens_medicao_pct_anterior_chk
  CHECK (percentual_anterior >= 0 AND percentual_anterior <= 100) NOT VALID;

-- Trigger: soma de % e valor medido por cronograma_item não pode ultrapassar 100% nem custo baseline
CREATE OR REPLACE FUNCTION public.fn_valida_itens_medicao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_soma_pct numeric;
  v_soma_val numeric;
  v_baseline numeric;
BEGIN
  -- Soma de % nas demais linhas (medições não canceladas) + a corrente
  SELECT COALESCE(SUM(im.percentual_atual), 0) INTO v_soma_pct
  FROM public.itens_medicao im
  JOIN public.medicoes m ON m.id = im.medicao_id
  WHERE im.cronograma_item_id = NEW.cronograma_item_id
    AND m.status::text <> 'cancelada'
    AND im.id <> NEW.id;

  IF v_soma_pct + COALESCE(NEW.percentual_atual, 0) > 100.01 THEN
    RAISE EXCEPTION 'Soma do %% acumulado do item ultrapassa 100%% (total seria %.2f%%)', v_soma_pct + NEW.percentual_atual;
  END IF;

  -- Valor: respeitar custo_baseline (fallback custo)
  SELECT COALESCE(custo_baseline, custo, 0) INTO v_baseline
  FROM public.cronograma_itens
  WHERE id = NEW.cronograma_item_id;

  IF v_baseline > 0 THEN
    SELECT COALESCE(SUM(im.valor_atual), 0) INTO v_soma_val
    FROM public.itens_medicao im
    JOIN public.medicoes m ON m.id = im.medicao_id
    WHERE im.cronograma_item_id = NEW.cronograma_item_id
      AND m.status::text <> 'cancelada'
      AND im.id <> NEW.id;

    IF v_soma_val + COALESCE(NEW.valor_atual, 0) > v_baseline * 1.0001 THEN
      RAISE EXCEPTION 'Soma do valor medido do item (%.2f) ultrapassa o custo baseline (%.2f)',
        v_soma_val + NEW.valor_atual, v_baseline;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_valida_itens_medicao ON public.itens_medicao;
CREATE TRIGGER trg_valida_itens_medicao
BEFORE INSERT OR UPDATE ON public.itens_medicao
FOR EACH ROW EXECUTE FUNCTION public.fn_valida_itens_medicao();

-- Onda 1.5: versão otimista (incremento automático)
ALTER TABLE public.medicoes        ADD COLUMN IF NOT EXISTS versao_otimista integer NOT NULL DEFAULT 1;
ALTER TABLE public.notas_fiscais   ADD COLUMN IF NOT EXISTS versao_otimista integer NOT NULL DEFAULT 1;
ALTER TABLE public.recebimentos    ADD COLUMN IF NOT EXISTS versao_otimista integer NOT NULL DEFAULT 1;
ALTER TABLE public.cronograma_itens ADD COLUMN IF NOT EXISTS versao_otimista integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.fn_bump_versao_otimista()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.versao_otimista := COALESCE(OLD.versao_otimista, 0) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_versao_medicoes ON public.medicoes;
CREATE TRIGGER trg_bump_versao_medicoes
BEFORE UPDATE ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

DROP TRIGGER IF EXISTS trg_bump_versao_nfs ON public.notas_fiscais;
CREATE TRIGGER trg_bump_versao_nfs
BEFORE UPDATE ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

DROP TRIGGER IF EXISTS trg_bump_versao_receb ON public.recebimentos;
CREATE TRIGGER trg_bump_versao_receb
BEFORE UPDATE ON public.recebimentos
FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

DROP TRIGGER IF EXISTS trg_bump_versao_crono ON public.cronograma_itens;
CREATE TRIGGER trg_bump_versao_crono
BEFORE UPDATE ON public.cronograma_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

REVOKE EXECUTE ON FUNCTION public.fn_valida_itens_medicao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_bump_versao_otimista() FROM PUBLIC, anon, authenticated;
