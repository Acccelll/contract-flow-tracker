
DROP VIEW IF EXISTS public.vw_obra_valores;
DROP VIEW IF EXISTS public.vw_nf_saldo;

-- Valores financeiros (R$): NUMERIC(14,2)
ALTER TABLE public.obras ALTER COLUMN valor_contrato TYPE numeric(14,2);
ALTER TABLE public.aditivos_contrato ALTER COLUMN valor_financeiro TYPE numeric(14,2);

ALTER TABLE public.cronograma_itens ALTER COLUMN custo TYPE numeric(14,2);
ALTER TABLE public.cronograma_itens ALTER COLUMN custo_baseline TYPE numeric(14,2);
ALTER TABLE public.cronograma_item_baseline ALTER COLUMN custo TYPE numeric(14,2);

ALTER TABLE public.medicoes ALTER COLUMN valor TYPE numeric(14,2);
ALTER TABLE public.itens_medicao ALTER COLUMN valor_atual TYPE numeric(14,2);
ALTER TABLE public.itens_medicao ALTER COLUMN valor_anterior TYPE numeric(14,2);

ALTER TABLE public.notas_fiscais ALTER COLUMN valor TYPE numeric(14,2);
ALTER TABLE public.notas_fiscais ALTER COLUMN valor_liquido TYPE numeric(14,2);
ALTER TABLE public.notas_fiscais ALTER COLUMN valor_servicos TYPE numeric(14,2);
ALTER TABLE public.notas_fiscais ALTER COLUMN inss_retido TYPE numeric(14,2);
ALTER TABLE public.notas_fiscais ALTER COLUMN iss_retido TYPE numeric(14,2);
ALTER TABLE public.notas_fiscais ALTER COLUMN outras_retencoes TYPE numeric(14,2);

ALTER TABLE public.recebimentos ALTER COLUMN valor_previsto TYPE numeric(14,2);
ALTER TABLE public.recebimentos ALTER COLUMN valor_recebido TYPE numeric(14,2);
ALTER TABLE public.recebimentos ALTER COLUMN valor_previsto_inicial TYPE numeric(14,2);

-- Percentuais: NUMERIC(7,4)
ALTER TABLE public.cronograma_itens ALTER COLUMN percentual_previsto TYPE numeric(7,4);
ALTER TABLE public.cronograma_itens ALTER COLUMN percentual_realizado TYPE numeric(7,4);
ALTER TABLE public.cronograma_item_baseline ALTER COLUMN percentual_previsto TYPE numeric(7,4);
ALTER TABLE public.itens_medicao ALTER COLUMN percentual_atual TYPE numeric(7,4);
ALTER TABLE public.itens_medicao ALTER COLUMN percentual_anterior TYPE numeric(7,4);
ALTER TABLE public.medicoes ALTER COLUMN percentual TYPE numeric(7,4);

-- Recriar views
CREATE VIEW public.vw_nf_saldo AS
SELECT nf.id AS nota_fiscal_id,
  nf.obra_id,
  nf.numero,
  COALESCE(nf.valor_liquido, nf.valor, 0::numeric) AS valor_liquido,
  COALESCE(sum(
    CASE WHEN r.status::text <> ALL (ARRAY['cancelado','previsto','a_receber','atrasado','inadimplente'])
      THEN COALESCE(r.valor_recebido, 0::numeric) ELSE 0::numeric END), 0::numeric) AS total_recebido,
  (COALESCE(nf.valor_liquido, nf.valor, 0::numeric) - COALESCE(sum(
    CASE WHEN r.status::text <> ALL (ARRAY['cancelado','previsto','a_receber','atrasado','inadimplente'])
      THEN COALESCE(r.valor_recebido, 0::numeric) ELSE 0::numeric END), 0::numeric)) AS saldo_aberto
FROM notas_fiscais nf
LEFT JOIN recebimentos r ON r.nota_fiscal_id = nf.id
GROUP BY nf.id;
ALTER VIEW public.vw_nf_saldo SET (security_invoker = true);

CREATE VIEW public.vw_obra_valores AS
SELECT o.id AS obra_id,
  o.valor_contrato AS valor_contrato_original,
  (o.valor_contrato + COALESCE((SELECT sum(a.valor_financeiro) FROM aditivos_contrato a
    WHERE a.obra_id = o.id AND a.status = 'aprovado'::aditivo_status), 0::numeric)) AS valor_contrato_atual,
  COALESCE((SELECT sum(cib.custo) FROM cronograma_baselines b
    JOIN cronograma_item_baseline cib ON cib.baseline_id = b.id
    WHERE b.obra_id = o.id AND b.versao = (SELECT max(versao) FROM cronograma_baselines WHERE obra_id = o.id)), 0::numeric) AS valor_planejado_baseline,
  COALESCE((SELECT sum(im.valor_atual) FROM itens_medicao im
    JOIN medicoes m ON m.id = im.medicao_id
    WHERE m.obra_id = o.id AND m.status::text = ANY (ARRAY['aprovada','faturada'])), 0::numeric) AS valor_executado,
  COALESCE((SELECT sum(a.dias_prazo) FROM aditivos_contrato a
    WHERE a.obra_id = o.id AND a.status = 'aprovado'::aditivo_status), 0::bigint) AS dias_aditivos
FROM obras o;
ALTER VIEW public.vw_obra_valores SET (security_invoker = true);
