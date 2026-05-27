
CREATE OR REPLACE FUNCTION public.fn_valida_transicao_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_de text;
  v_para text;
  v_ok boolean := false;
BEGIN
  v_de := OLD.status::text;
  v_para := NEW.status::text;
  IF v_de = v_para THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'medicoes' THEN
    v_ok := (v_de, v_para) IN (
      ('rascunho','em_revisao'), ('rascunho','enviada'), ('rascunho','cancelada'),
      ('em_revisao','rascunho'), ('em_revisao','enviada'), ('em_revisao','cancelada'),
      ('enviada','aprovada'), ('enviada','rejeitada'), ('enviada','em_revisao'), ('enviada','cancelada'),
      ('rejeitada','rascunho'), ('rejeitada','em_revisao'), ('rejeitada','cancelada'),
      ('aprovada','faturada'), ('aprovada','cancelada'),
      ('faturada','cancelada')
    );
  ELSIF TG_TABLE_NAME = 'notas_fiscais' THEN
    v_ok := (v_de, v_para) IN (
      ('rascunho','emitida'), ('rascunho','cancelada'),
      ('emitida','enviada'), ('emitida','cancelada'),
      ('enviada','aprovada_cliente'), ('enviada','recebida'), ('enviada','cancelada'),
      ('aprovada_cliente','recebida'), ('aprovada_cliente','cancelada'),
      ('recebida','cancelada')
    );
  ELSIF TG_TABLE_NAME = 'recebimentos' THEN
    v_ok := (v_de, v_para) IN (
      ('previsto','a_receber'), ('previsto','parcial'), ('previsto','pago'), ('previsto','recebido'),
      ('previsto','atrasado'), ('previsto','inadimplente'), ('previsto','cancelado'),
      ('a_receber','parcial'), ('a_receber','pago'), ('a_receber','recebido'),
      ('a_receber','atrasado'), ('a_receber','inadimplente'), ('a_receber','cancelado'),
      ('parcial','pago'), ('parcial','recebido'), ('parcial','atrasado'),
      ('parcial','inadimplente'), ('parcial','cancelado'),
      ('atrasado','parcial'), ('atrasado','pago'), ('atrasado','recebido'),
      ('atrasado','inadimplente'), ('atrasado','cancelado'),
      ('antecipado','pago'), ('antecipado','recebido'), ('antecipado','cancelado'),
      ('pago','antecipado'), ('pago','cancelado'),
      ('recebido','cancelado'),
      ('inadimplente','parcial'), ('inadimplente','pago'), ('inadimplente','recebido'), ('inadimplente','cancelado')
    );
  ELSE
    RETURN NEW;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Transição de status inválida em %: % -> %', TG_TABLE_NAME, v_de, v_para;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_valida_transicao_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_valida_status_medicoes ON public.medicoes;
CREATE TRIGGER trg_valida_status_medicoes
BEFORE UPDATE OF status ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.fn_valida_transicao_status();

DROP TRIGGER IF EXISTS trg_valida_status_nfs ON public.notas_fiscais;
CREATE TRIGGER trg_valida_status_nfs
BEFORE UPDATE OF status ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.fn_valida_transicao_status();

DROP TRIGGER IF EXISTS trg_valida_status_receb ON public.recebimentos;
CREATE TRIGGER trg_valida_status_receb
BEFORE UPDATE OF status ON public.recebimentos
FOR EACH ROW EXECUTE FUNCTION public.fn_valida_transicao_status();

-- View de saldo por NF
CREATE OR REPLACE VIEW public.vw_nf_saldo AS
SELECT
  nf.id AS nota_fiscal_id,
  nf.obra_id,
  nf.numero,
  COALESCE(nf.valor_liquido, nf.valor, 0) AS valor_liquido,
  COALESCE(SUM(CASE
    WHEN r.status::text NOT IN ('cancelado','previsto','a_receber','atrasado','inadimplente')
      THEN COALESCE(r.valor_recebido, 0) ELSE 0
  END), 0) AS total_recebido,
  COALESCE(nf.valor_liquido, nf.valor, 0)
    - COALESCE(SUM(CASE
        WHEN r.status::text NOT IN ('cancelado','previsto','a_receber','atrasado','inadimplente')
          THEN COALESCE(r.valor_recebido, 0) ELSE 0
      END), 0) AS saldo_aberto
FROM public.notas_fiscais nf
LEFT JOIN public.recebimentos r ON r.nota_fiscal_id = nf.id
GROUP BY nf.id;

GRANT SELECT ON public.vw_nf_saldo TO authenticated;
